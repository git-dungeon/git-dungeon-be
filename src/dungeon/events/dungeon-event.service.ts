import {
  BadRequestException,
  Inject,
  Injectable,
  PreconditionFailedException,
} from '@nestjs/common';
import type { DungeonAction, DungeonState } from '@prisma/client';
import {
  BASE_PROGRESS_INCREMENT,
  BATTLE_PROGRESS_INCREMENT,
  DEFAULT_EVENT_WEIGHTS,
  DungeonActionMapping,
  DungeonEventContext,
  DungeonEventLogStub,
  DungeonEventProcessor,
  DungeonEventProcessorOutput,
  DungeonEventResult,
  DungeonEventSelector,
  DungeonEventType,
  MAX_FLOOR_PROGRESS,
} from './event.types';
import type {
  ProgressDelta,
  DungeonLogDelta,
} from '../../common/logs/dungeon-log-delta';
import { SEEDED_RNG_FACTORY, SeededRandomFactory } from './seeded-rng.provider';
import { WeightedDungeonEventSelector } from './event-selector';
import { DungeonEventProcessors } from './event.tokens';
import { DungeonLogBuilder } from './dungeon-log.builder';

@Injectable()
export class DungeonEventService {
  private readonly selector: DungeonEventSelector =
    new WeightedDungeonEventSelector();

  private readonly actionMapping: DungeonActionMapping = {
    [DungeonEventType.BATTLE]: 'BATTLE',
    [DungeonEventType.TREASURE]: 'TREASURE',
    [DungeonEventType.REST]: 'REST',
    [DungeonEventType.TRAP]: 'TRAP',
    [DungeonEventType.MOVE]: 'EXPLORING',
  } as const satisfies DungeonActionMapping;

  constructor(
    @Inject(SEEDED_RNG_FACTORY)
    private readonly rngFactory: SeededRandomFactory,
    @Inject(DungeonEventProcessors)
    private readonly processors: Record<
      DungeonEventType,
      DungeonEventProcessor
    >,
    @Inject(DungeonLogBuilder)
    private readonly logBuilder: DungeonLogBuilder,
  ) {}

  execute(context: DungeonEventContext): DungeonEventResult {
    const apCost = context.apCost ?? 1;
    const weights = context.weights ?? DEFAULT_EVENT_WEIGHTS;
    const rng = this.rngFactory.create(
      this.buildSeed(context.seed, context.actionCounter),
    );
    const stateBefore: DungeonState = { ...context.state };

    if (apCost <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AP_COST',
        message: 'AP 소모량은 1 이상이어야 합니다.',
      });
    }

    if (stateBefore.ap < apCost) {
      throw new PreconditionFailedException({
        code: 'INSUFFICIENT_AP',
        message: 'AP가 부족합니다.',
      });
    }

    const rngValue = rng.next();
    const selectedEvent = this.selector.select({
      state: stateBefore,
      rngValue,
      weights,
    });

    const logs: DungeonEventLogStub[] = [];
    const startedAt = new Date();
    const apDeductedState = this.applyApCost(stateBefore, apCost);
    const startedState = this.startAction(
      apDeductedState,
      selectedEvent,
      startedAt,
    );
    const processorResult = this.processEvent(
      selectedEvent,
      startedState,
      rngValue,
      logs,
    );

    const progressedState =
      selectedEvent === DungeonEventType.MOVE
        ? processorResult
        : this.applyProgress(processorResult, selectedEvent);

    const progressDetail =
      selectedEvent === DungeonEventType.MOVE
        ? undefined
        : this.buildProgressDetail(
            startedState.floorProgress,
            progressedState.state.floorProgress,
          );

    logs.push({
      type: selectedEvent,
      status: 'COMPLETED',
      delta: this.appendProgressDelta(processorResult.delta, progressDetail),
      extra: processorResult.extra,
    });

    const needsForcedMove =
      selectedEvent !== DungeonEventType.MOVE &&
      progressedState.state.floorProgress >= MAX_FLOOR_PROGRESS;

    const finalState = this.completeFlow(
      progressedState.state,
      needsForcedMove,
      rngValue,
      startedAt,
      logs,
    );

    const builtLogs = this.logBuilder.buildExplorationLogs({
      stateBefore,
      stateAfter: finalState,
      logs,
      turnNumber: context.actionCounter,
    });

    return {
      selectedEvent,
      forcedMove: needsForcedMove,
      stateBefore,
      stateAfter: finalState,
      rawLogs: logs,
      logs: builtLogs,
    };
  }

  private completeFlow(
    state: DungeonState,
    forcedMove: boolean,
    rngValue: number,
    startedAt: Date,
    logs: DungeonEventLogStub[],
  ): DungeonState {
    let workingState = state;

    if (forcedMove) {
      const moveStarted = this.startAction(
        workingState,
        DungeonEventType.MOVE,
        startedAt,
      );
      const moveResult = this.processEvent(
        DungeonEventType.MOVE,
        moveStarted,
        rngValue,
        logs,
      );

      logs.push({
        type: DungeonEventType.MOVE,
        status: 'COMPLETED',
        delta: moveResult.delta,
        extra: moveResult.extra,
      });

      workingState = moveResult.state;
    }

    const completedState: DungeonState = {
      ...workingState,
      currentAction: 'IDLE',
      currentActionStartedAt: null,
      version: workingState.version + 1,
      updatedAt: new Date(),
    };

    return completedState;
  }

  private processEvent(
    type: DungeonEventType,
    state: DungeonState,
    rngValue: number,
    logs: DungeonEventLogStub[],
  ): DungeonEventProcessorOutput {
    const processor = this.processors[type];

    if (!processor) {
      throw new BadRequestException({
        code: 'EVENT_PROCESSOR_NOT_FOUND',
        message: `이벤트 처리기를 찾을 수 없습니다: ${type}`,
      });
    }

    logs.push({
      type,
      status: 'STARTED',
    });

    return processor.process({
      state,
      rngValue,
    });
  }

  private applyProgress(
    result: DungeonEventProcessorOutput,
    type: DungeonEventType,
  ): DungeonEventProcessorOutput {
    const increment =
      type === DungeonEventType.BATTLE
        ? BATTLE_PROGRESS_INCREMENT
        : BASE_PROGRESS_INCREMENT;

    const nextProgress = Math.min(
      MAX_FLOOR_PROGRESS,
      Math.max(0, result.state.floorProgress + increment),
    );

    return {
      ...result,
      state: {
        ...result.state,
        floorProgress: nextProgress,
      },
    };
  }

  private buildProgressDetail(
    previous: number,
    current: number,
  ): ProgressDelta | undefined {
    if (previous === current) {
      return undefined;
    }

    return {
      previousProgress: previous,
      floorProgress: current,
      delta: current - previous,
    };
  }

  private appendProgressDelta(
    delta: DungeonLogDelta | undefined,
    progress: ProgressDelta | undefined,
  ): DungeonLogDelta | undefined {
    if (!progress || !delta) {
      return delta;
    }

    switch (delta.type) {
      case 'REST':
      case 'TRAP':
      case 'TREASURE':
      case 'BATTLE':
        return {
          ...delta,
          detail: {
            ...delta.detail,
            progress,
          },
        } as DungeonLogDelta;
      default:
        return delta;
    }
  }

  private applyApCost(state: DungeonState, apCost: number): DungeonState {
    const nextAp = state.ap - apCost;

    if (nextAp < 0) {
      throw new PreconditionFailedException({
        code: 'INSUFFICIENT_AP',
        message: 'AP가 부족합니다.',
      });
    }

    return {
      ...state,
      ap: nextAp,
    };
  }

  private startAction(
    state: DungeonState,
    event: DungeonEventType,
    startedAt: Date,
  ): DungeonState {
    return {
      ...state,
      currentAction: this.toDungeonAction(event),
      currentActionStartedAt: startedAt,
    };
  }

  private toDungeonAction(event: DungeonEventType): DungeonAction {
    return this.actionMapping[event];
  }

  private buildSeed(seed: string, actionCounter?: number): string {
    if (actionCounter === undefined) {
      return seed;
    }

    return `${seed}:${actionCounter}`;
  }
}
