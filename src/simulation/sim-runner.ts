import fs from 'node:fs';
import path from 'node:path';
import type { DungeonState, Prisma } from '@prisma/client';
import { DungeonEventService } from '../dungeon/events/dungeon-event.service';
import { DungeonLogBuilder } from '../dungeon/events/dungeon-log.builder';
import { SeedrandomFactory } from '../dungeon/events/seeded-rng.provider';
import { BattleEventProcessor } from '../dungeon/events/processors/battle-event.processor';
import { RestEventProcessor } from '../dungeon/events/processors/rest-event.processor';
import { TrapEventProcessor } from '../dungeon/events/processors/trap-event.processor';
import { TreasureEventProcessor } from '../dungeon/events/processors/treasure-event.processor';
import { MoveEventProcessor } from '../dungeon/events/processors/move-event.processor';
import { EmptyEventProcessor } from '../dungeon/events/processors/empty-event.processor';
import { MonsterRegistry } from '../dungeon/monsters';
import { DropService } from '../dungeon/drops/drop.service';
import { DungeonEventType } from '../dungeon/events/event.types';
import { DropTableRegistry } from '../dungeon/drops/drop-table';
import { loadEventConfig } from '../dungeon/events/config/event-config.loader';
import type { CatalogMonster } from '../catalog/catalog.schema';
import type { DungeonEventProcessor } from '../dungeon/events/event.types';
import type { SimulationResult, SimulationSnapshot } from './types';
import type { SimulationStep } from './types';
import type { SimulationSummary } from './types';
import { PrismaService } from '../prisma/prisma.service';
import { DropInventoryService } from '../dungeon/drops/drop-inventory.service';

type RunOptions = {
  seed: string;
  userId: string;
  maxActions: number;
  dryRun: boolean;
  initialState?: DungeonState;
  fixtureName?: string;
  skipInventoryApply?: boolean;
};

type FixtureExpectation = {
  name: string;
  snapshot: SimulationSnapshot;
};

type PersistDeps = {
  prisma: PrismaService;
  dropInventoryService: DropInventoryService;
};

const eventConfig = loadEventConfig();
type MonstersFile = { monsters: CatalogMonster[] };
const monstersFile = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'config/catalog/monsters.json'),
    'utf-8',
  ),
) as MonstersFile;
const monsterRegistry = MonsterRegistry.from(monstersFile.monsters);
const dropRegistry = DropTableRegistry.fromFile();
const dropService = new DropService(dropRegistry);
const rngFactory = new SeedrandomFactory();

const processors: Record<DungeonEventType, DungeonEventProcessor> = {
  [DungeonEventType.BATTLE]: new BattleEventProcessor(monsterRegistry, {
    eliteRate: eventConfig.battle.eliteRate,
    dropChance: eventConfig.battle.dropChance,
    eliteDropMultiplier: eventConfig.battle.eliteDropMultiplier,
    critBase: eventConfig.battle.critBase,
    critLuckFactor: eventConfig.battle.critLuckFactor,
    turnLimit: eventConfig.battle.turnLimit,
    eliteExpBonus: eventConfig.battle.exp.eliteBonus,
    gold: eventConfig.battle.gold,
    dropService,
  }),
  [DungeonEventType.TREASURE]: new TreasureEventProcessor(
    eventConfig.effects.TREASURE,
    rngFactory,
    dropService,
  ),
  [DungeonEventType.REST]: new RestEventProcessor(eventConfig.effects.REST),
  [DungeonEventType.TRAP]: new TrapEventProcessor(eventConfig.effects.TRAP),
  [DungeonEventType.EMPTY]: new EmptyEventProcessor(),
  [DungeonEventType.MOVE]: new MoveEventProcessor(),
};

export class SimulationPersistConflictError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly version: number,
  ) {
    super(message);
    this.name = 'SimulationPersistConflictError';
  }
}

export class SimulationRunner {
  private readonly logBuilder = new DungeonLogBuilder();
  private readonly dryRunService: DungeonEventService;
  private readonly persistDeps?: PersistDeps;
  private readonly persistService?: DungeonEventService;

  constructor(enablePersist: boolean) {
    this.dryRunService = new DungeonEventService(
      rngFactory,
      processors,
      this.logBuilder,
    );

    if (enablePersist) {
      const prisma = new PrismaService();
      this.persistDeps = {
        prisma,
        dropInventoryService: new DropInventoryService(prisma),
      };
      this.persistService = new DungeonEventService(
        rngFactory,
        processors,
        this.logBuilder,
        this.persistDeps.dropInventoryService,
      );
    }
  }

  /**
   * CLI/스크립트 환경에서 commit 모드로 실행 시 생성한 Prisma 연결을 정리한다.
   * Nest 모듈에서는 onModuleDestroy로 정리되므로 별도 호출이 필요 없다.
   */
  async close(): Promise<void> {
    if (!this.persistDeps) return;
    try {
      await this.persistDeps.prisma.$disconnect();
    } catch {
      // best-effort
    }
  }

  async run(
    options: RunOptions,
    expectation?: FixtureExpectation,
  ): Promise<SimulationResult> {
    const service = options.dryRun
      ? this.dryRunService
      : (this.persistService ?? this.dryRunService);

    let state =
      options.initialState ??
      (await this.fetchStateFromDb(options.userId, options.dryRun));
    if (!state) {
      throw new Error(
        '초기 DungeonState를 찾을 수 없습니다. fixture 또는 DB 상태를 확인하세요.',
      );
    }

    state = { ...state, userId: options.userId };
    let actionCounter =
      expectation?.snapshot.results?.[0]?.actionCounter ?? state.version ?? 0;

    const steps: SimulationStep[] = [];
    const startedAt = Date.now();
    const initialAp = state.ap;
    const initialVersion = state.version;
    let actionsCompleted = 0;

    for (let i = 0; i < options.maxActions; i += 1) {
      if (state.ap <= 0) break;

      const result = await service.execute({
        state,
        seed: options.seed,
        actionCounter,
        apCost: 1,
        weights: eventConfig.weights,
        skipInventoryApply: options.skipInventoryApply,
      });

      if (!options.dryRun && this.persistDeps) {
        const persisted = await this.persistResult(state, result);
        if (!persisted) {
          throw new SimulationPersistConflictError(
            `상태 저장에 실패했습니다 (userId=${options.userId}, version=${state.version})`,
            options.userId,
            state.version ?? 0,
          );
        }
        state = persisted;
      } else {
        state = result.stateAfter;
      }

      steps.push({
        actionCounter,
        selectedEvent: result.selectedEvent,
        stateAfter: {
          hp: state.hp,
          ap: state.ap,
          floor: state.floor,
          floorProgress: state.floorProgress,
          level: state.level,
          exp: state.exp,
          version: state.version,
        },
        logs: result.logs.map((log) => ({
          action: log.action,
          status: log.status,
          delta: log.delta,
          extra: log.extra,
          category: log.category,
          floor: log.floor,
          turnNumber: log.turnNumber,
        })),
      });

      actionsCompleted += 1;
      actionCounter += 1;
    }

    const durationMs = Date.now() - startedAt;
    const summary: SimulationSummary = {
      actionsAttempted: options.maxActions,
      actionsCompleted,
      apConsumed: initialAp - state.ap,
      durationMs,
      initialVersion,
      finalVersion: state.version,
      finalAp: state.ap,
      finalFloor: state.floor,
      finalProgress: state.floorProgress,
    };

    const fixtureCheck =
      expectation && expectation.snapshot
        ? this.compareWithFixture(expectation.name, steps, expectation.snapshot)
        : undefined;

    return { steps, summary, fixtureCheck };
  }

  private async fetchStateFromDb(
    userId: string,
    dryRun: boolean,
  ): Promise<DungeonState | null> {
    if (dryRun) {
      return null;
    }

    if (!this.persistDeps) {
      return null;
    }

    return this.persistDeps.prisma.dungeonState.findUnique({
      where: { userId },
    });
  }

  private async persistResult(
    stateBefore: DungeonState,
    result: Awaited<ReturnType<DungeonEventService['execute']>>,
  ): Promise<DungeonState | null> {
    if (!this.persistDeps) {
      return null;
    }

    const { prisma } = this.persistDeps;
    return prisma.$transaction(async (tx) => {
      const updateResult = await tx.dungeonState.updateMany({
        where: { userId: stateBefore.userId, version: stateBefore.version },
        data: this.buildStateUpdate(result.stateAfter),
      });

      if (updateResult.count === 0) {
        return null;
      }

      if (result.logs.length > 0) {
        await tx.dungeonLog.createMany({
          data: result.logs.map((log) => ({
            userId: stateBefore.userId,
            category: log.category,
            action: log.action,
            status: log.status,
            floor: log.floor ?? null,
            turnNumber: log.turnNumber ?? null,
            stateVersionBefore: log.stateVersionBefore ?? null,
            stateVersionAfter: log.stateVersionAfter ?? null,
            delta:
              (log.delta as Prisma.InputJsonValue | undefined) ?? undefined,
            extra:
              (log.extra as Prisma.InputJsonValue | undefined) ?? undefined,
            createdAt: log.createdAt ?? new Date(),
          })),
        });
      }

      return result.stateAfter;
    });
  }

  private buildStateUpdate(
    state: DungeonState,
  ): Prisma.DungeonStateUpdateManyMutationInput {
    return {
      level: state.level,
      exp: state.exp,
      hp: state.hp,
      maxHp: state.maxHp,
      atk: state.atk,
      def: state.def,
      luck: state.luck,
      floor: state.floor,
      maxFloor: state.maxFloor,
      floorProgress: state.floorProgress,
      gold: state.gold,
      ap: state.ap,
      currentAction: state.currentAction,
      currentActionStartedAt: state.currentActionStartedAt,
      version: state.version,
    };
  }

  private compareWithFixture(
    name: string,
    actual: SimulationStep[],
    snapshot: SimulationSnapshot,
  ) {
    const mismatches: string[] = [];
    const normalizePayload = (value: unknown): unknown => {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return value.map((item) => normalizePayload(item));
      }
      if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
          .map(([key, val]) => [key, normalizePayload(val)] as const)
          .filter(([, val]) => val !== undefined);
        entries.sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries);
      }
      return value;
    };
    const isEqualPayload = (a: unknown, b: unknown): boolean => {
      const normalizedA = normalizePayload(a);
      const normalizedB = normalizePayload(b);
      return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
    };

    snapshot.results.forEach((expectedStep, idx) => {
      const actualStep = actual[idx];
      if (!actualStep) {
        mismatches.push(
          `step ${idx}: expected actionCounter ${expectedStep.actionCounter} but runner stopped early`,
        );
        return;
      }

      if (actualStep.actionCounter !== expectedStep.actionCounter) {
        mismatches.push(
          `step ${idx}: actionCounter expected ${expectedStep.actionCounter} got ${actualStep.actionCounter}`,
        );
      }

      const actualEvent = String(actualStep.selectedEvent);
      const expectedEvent = String(expectedStep.selectedEvent);
      if (actualEvent !== expectedEvent) {
        mismatches.push(
          `step ${idx}: event expected ${expectedStep.selectedEvent} got ${actualStep.selectedEvent}`,
        );
      }

      const keys: Array<keyof SimulationStep['stateAfter']> = [
        'hp',
        'ap',
        'floor',
        'floorProgress',
        'level',
        'exp',
        'version',
      ];
      keys.forEach((key) => {
        if (actualStep.stateAfter[key] !== expectedStep.stateAfter[key]) {
          mismatches.push(
            `step ${idx}: ${key} expected ${expectedStep.stateAfter[key]} got ${actualStep.stateAfter[key]}`,
          );
        }
      });

      const expectedLogs = expectedStep.extra ?? [];
      const actualLogs = actualStep.logs ?? [];
      if (actualLogs.length !== expectedLogs.length) {
        mismatches.push(
          `step ${idx}: logs length expected ${expectedLogs.length} got ${actualLogs.length}`,
        );
      }

      const compareCount = Math.min(actualLogs.length, expectedLogs.length);
      for (let logIndex = 0; logIndex < compareCount; logIndex += 1) {
        const expectedLog = expectedLogs[logIndex];
        const actualLog = actualLogs[logIndex];
        if (!actualLog) {
          mismatches.push(`step ${idx}: log ${logIndex} missing in actual`);
          continue;
        }

        if (actualLog.action !== expectedLog.action) {
          mismatches.push(
            `step ${idx}: log ${logIndex} action expected ${expectedLog.action} got ${actualLog.action}`,
          );
        }

        if (actualLog.status !== expectedLog.status) {
          mismatches.push(
            `step ${idx}: log ${logIndex} status expected ${expectedLog.status} got ${actualLog.status}`,
          );
        }

        if (actualLog.floor !== expectedLog.floor) {
          mismatches.push(
            `step ${idx}: log ${logIndex} floor expected ${expectedLog.floor} got ${actualLog.floor}`,
          );
        }

        if (actualLog.turnNumber !== expectedLog.turnNumber) {
          mismatches.push(
            `step ${idx}: log ${logIndex} turnNumber expected ${expectedLog.turnNumber} got ${actualLog.turnNumber}`,
          );
        }

        if (actualLog.category !== expectedLog.category) {
          mismatches.push(
            `step ${idx}: log ${logIndex} category expected ${expectedLog.category} got ${actualLog.category}`,
          );
        }

        if (!isEqualPayload(actualLog.delta, expectedLog.delta)) {
          mismatches.push(`step ${idx}: log ${logIndex} delta mismatch`);
        }

        if (!isEqualPayload(actualLog.extra, expectedLog.extra)) {
          mismatches.push(`step ${idx}: log ${logIndex} extra mismatch`);
        }
      }
    });

    if (actual.length > snapshot.results.length) {
      mismatches.push(
        `runner produced ${actual.length} steps but fixture has ${snapshot.results.length}`,
      );
    }

    return {
      name,
      passed: mismatches.length === 0,
      mismatches,
    };
  }
}
