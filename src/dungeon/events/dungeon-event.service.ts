import {
  BadRequestException,
  Inject,
  Injectable,
  PreconditionFailedException,
} from '@nestjs/common';
import {
  DungeonLogCategory,
  type DungeonAction,
  type DungeonState,
} from '@prisma/client';
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
  StatsDelta,
  InventoryDelta,
} from '../../common/logs/dungeon-log-delta';
import { SEEDED_RNG_FACTORY, SeededRandomFactory } from './seeded-rng.provider';
import { WeightedDungeonEventSelector } from './event-selector';
import { DungeonEventProcessors } from './event.tokens';
import { DungeonLogBuilder } from './dungeon-log.builder';
import type { SeededRandom } from './seeded-rng.provider';
import { DropInventoryService } from '../drops/drop-inventory.service';
import { mapDropsToInventoryAdds } from '../drops/drop.utils';

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
    private readonly dropInventoryService?: DropInventoryService,
  ) {}

  async execute(context: DungeonEventContext): Promise<DungeonEventResult> {
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
      apCost,
    );

    const progressedState =
      selectedEvent === DungeonEventType.MOVE
        ? processorResult
        : this.applyProgress(processorResult, selectedEvent);
    const completedFloor = progressedState.state.floor;

    const deathApplied = this.applyDeathIfNeeded(
      progressedState.state,
      selectedEvent,
      processorResult.extra,
    );

    const expApplied = this.applyExpAndLevelUp(
      deathApplied.state,
      deathApplied.alive ? (processorResult.expGained ?? 0) : 0,
      rng,
    );

    const progressDetail =
      selectedEvent === DungeonEventType.MOVE || !deathApplied.alive
        ? undefined
        : this.buildProgressDetail(
            startedState.floorProgress,
            expApplied.state.floorProgress,
          );

    let completedDelta = this.appendProgressDelta(
      processorResult.delta,
      progressDetail,
    );
    if (!deathApplied.alive) {
      completedDelta = this.stripProgressDelta(completedDelta);
    }
    completedDelta = this.mergeExpDelta(completedDelta, expApplied.expDelta);

    logs.push({
      type: selectedEvent,
      status: 'COMPLETED',
      delta: completedDelta,
      extra: processorResult.extra,
      floor: completedFloor,
    });

    if (deathApplied.deathLog) {
      logs.push(deathApplied.deathLog);
    }
    if (deathApplied.reviveLog) {
      logs.push(deathApplied.reviveLog);
    }

    if (expApplied.levelUpLogs.length) {
      logs.push(
        ...expApplied.levelUpLogs.map((log) => ({
          ...log,
          floor: log.floor ?? expApplied.state.floor,
        })),
      );
    }

    const needsForcedMove =
      selectedEvent !== DungeonEventType.MOVE &&
      expApplied.state.floorProgress >= MAX_FLOOR_PROGRESS;

    const finalState = this.completeFlow(
      expApplied.state,
      needsForcedMove,
      rngValue,
      startedAt,
      logs,
    );

    let inventoryAdds: InventoryDelta['added'] | undefined;

    const shouldApplyDrops =
      !!processorResult.drops?.length &&
      !!this.dropInventoryService &&
      !context.skipInventoryApply &&
      !this.shouldSkipInventoryApply();

    if (shouldApplyDrops) {
      inventoryAdds = await this.dropInventoryService.applyDrops({
        userId: stateBefore.userId,
        drops: processorResult.drops ?? [],
      });
    } else if (processorResult.drops?.length) {
      inventoryAdds = mapDropsToInventoryAdds(processorResult.drops);
    }

    if (inventoryAdds?.length) {
      logs.push({
        type: selectedEvent,
        status: 'COMPLETED',
        actionOverride: 'ACQUIRE_ITEM',
        categoryOverride: DungeonLogCategory.STATUS,
        delta: {
          type: 'ACQUIRE_ITEM',
          detail: {
            inventory: {
              added: inventoryAdds,
            },
          },
        },
        extra: {
          type: 'ACQUIRE_ITEM',
          details: {
            reward: {
              source: selectedEvent,
              drop: processorResult.dropMeta
                ? {
                    tableId: processorResult.dropMeta.tableId ?? undefined,
                    isElite: processorResult.dropMeta.isElite,
                    items: processorResult.dropMeta.items?.map((item) => ({
                      code: item.code,
                      quantity: item.quantity,
                    })),
                  }
                : undefined,
            },
          },
        },
      });
    }

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
      drops: processorResult.drops,
      inventoryAdds,
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
        undefined,
      );

      logs.push({
        type: DungeonEventType.MOVE,
        status: 'COMPLETED',
        delta: moveResult.delta,
        extra: moveResult.extra,
        floor: moveResult.state.floor,
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
    apCost?: number,
  ): DungeonEventProcessorOutput {
    const processor = this.processors[type];

    if (!processor) {
      throw new BadRequestException({
        code: 'EVENT_PROCESSOR_NOT_FOUND',
        message: `이벤트 처리기를 찾을 수 없습니다: ${type}`,
      });
    }

    const startedDelta = this.buildStartedApDelta(type, apCost);
    const result = processor.process({
      state,
      rngValue,
    });

    logs.push({
      type,
      status: 'STARTED',
      delta: startedDelta,
      extra: result.startedExtra,
      floor: state.floor,
    });

    if (result.followUpLogs?.length) {
      logs.push(
        ...result.followUpLogs.map((log) => ({
          ...log,
          floor: log.floor ?? state.floor,
        })),
      );
    }

    return result;
  }

  private applyExpAndLevelUp(
    state: DungeonState,
    expGained: number,
    rng: SeededRandom,
  ): {
    state: DungeonState;
    expDelta?: StatsDelta;
    alive: boolean;
    levelUpLogs: DungeonEventLogStub[];
  } {
    if (expGained <= 0) {
      return { state, alive: state.hp > 0, levelUpLogs: [] };
    }

    let nextState: DungeonState = { ...state, exp: state.exp + expGained };
    const expDelta: StatsDelta = { exp: expGained };

    const levelUps: DungeonEventLogStub[] = [];
    let currentLevel = state.level;

    while (nextState.exp >= currentLevel * 10) {
      const threshold = currentLevel * 10;
      nextState.exp -= threshold;
      currentLevel += 1;
      nextState = { ...nextState, level: currentLevel };

      // 랜덤 스탯 증가
      const stats = ['atk', 'def', 'luck'] as const;
      const statKey = stats[Math.floor(rng.next() * stats.length)];
      nextState = { ...nextState, [statKey]: nextState[statKey] + 1 };

      // HP/MaxHP 보너스
      const newMaxHp = nextState.maxHp + 2;
      nextState = {
        ...nextState,
        maxHp: newMaxHp,
        hp: Math.min(newMaxHp, nextState.hp + 2),
      };

      levelUps.push({
        type: DungeonEventType.BATTLE,
        status: 'COMPLETED',
        actionOverride: 'LEVEL_UP',
        delta: {
          type: 'LEVEL_UP',
          detail: {
            stats: {
              level: 1,
              [statKey]: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
        extra: {
          type: 'LEVEL_UP',
          details: {
            previousLevel: currentLevel - 1,
            currentLevel,
            threshold,
            statsGained: {
              [statKey]: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
      });
    }

    return {
      state: nextState,
      expDelta,
      alive: nextState.hp > 0,
      levelUpLogs: levelUps,
    };
  }

  private applyDeathIfNeeded(
    state: DungeonState,
    eventType: DungeonEventType,
    extra: DungeonEventProcessorOutput['extra'],
  ): {
    state: DungeonState;
    alive: boolean;
    deathLog?: DungeonEventLogStub;
    reviveLog?: DungeonEventLogStub;
  } {
    if (state.hp > 0) {
      return { state, alive: true };
    }

    const preState = { ...state };
    const deadState: DungeonState = {
      ...state,
      hp: 0,
      floor: 1,
      floorProgress: 0,
    };
    const revivedState: DungeonState = {
      ...deadState,
      hp: deadState.maxHp,
    };

    const cause =
      extra?.type === 'BATTLE'
        ? (extra.details.cause ?? 'PLAYER_DEFEATED')
        : eventType === DungeonEventType.TRAP
          ? 'TRAP_DAMAGE'
          : 'HP_DEPLETED';

    const deathLog: DungeonEventLogStub = {
      type: eventType,
      status: 'COMPLETED',
      actionOverride: 'DEATH',
      floor: deadState.floor,
      delta: {
        type: 'DEATH',
        detail: {
          stats: {},
          progress: {
            previousProgress: preState.floorProgress,
            floorProgress: 0,
            delta: -preState.floorProgress,
          },
        },
      },
      extra: {
        type: 'DEATH',
        details: {
          cause,
        },
      },
    };

    const reviveLog: DungeonEventLogStub = {
      type: eventType,
      status: 'COMPLETED',
      actionOverride: 'REVIVE',
      floor: revivedState.floor,
      delta: {
        type: 'REVIVE',
        detail: {
          stats: {
            hp: revivedState.hp - deadState.hp,
          },
        },
      },
    };

    return { state: revivedState, alive: false, deathLog, reviveLog };
  }

  private mergeExpDelta(
    delta: DungeonLogDelta | undefined,
    expDelta?: StatsDelta,
  ): DungeonLogDelta | undefined {
    if (!delta || !expDelta?.exp) return delta;
    if (delta.type !== 'BATTLE') return delta;

    const mergedStats: StatsDelta = {
      ...(delta.detail.stats ?? {}),
      exp: (delta.detail.stats?.exp ?? 0) + expDelta.exp,
    };

    return {
      ...delta,
      detail: {
        ...delta.detail,
        stats: mergedStats,
      },
    };
  }

  private buildStartedApDelta(
    type: DungeonEventType,
    apCost?: number,
  ): DungeonLogDelta | undefined {
    if (!Number.isFinite(apCost) || !apCost || apCost <= 0) {
      return undefined;
    }

    const stats: StatsDelta = { ap: -apCost };

    switch (type) {
      case DungeonEventType.BATTLE:
        return { type: 'BATTLE', detail: { stats } };
      case DungeonEventType.REST:
        return { type: 'REST', detail: { stats } };
      case DungeonEventType.TRAP:
        return { type: 'TRAP', detail: { stats } };
      case DungeonEventType.TREASURE:
        return { type: 'TREASURE', detail: { stats } };
      default:
        return undefined;
    }
  }

  private stripProgressDelta(
    delta: DungeonLogDelta | undefined,
  ): DungeonLogDelta | undefined {
    if (!delta) return delta;

    switch (delta.type) {
      case 'REST':
      case 'TRAP':
      case 'TREASURE':
      case 'BATTLE': {
        // undefined로 덮어쓰면 snapshot/serialization에서 `progress: undefined`가 남을 수 있어 키 자체를 제거한다.
        const { progress: removedProgress, ...detailWithoutProgress } =
          delta.detail;
        void removedProgress;
        return { ...delta, detail: detailWithoutProgress } as DungeonLogDelta;
      }
      default:
        return delta;
    }
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

  private shouldSkipInventoryApply(): boolean {
    return (
      process.env.DATABASE_SKIP_CONNECTION === 'true' ||
      process.env.NODE_ENV === 'test'
    );
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
