import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { DungeonState, Prisma } from '@prisma/client';
import { DungeonEventService } from '../events/dungeon-event.service';
import type { DungeonEventResult } from '../events/event.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DungeonBatchLockService } from './dungeon-batch.lock.service';
import { loadEnvironment } from '../../config/environment';
import { SimpleQueue } from '../../common/queue/simple-queue';

type BatchConfig = {
  cron: string;
  maxUsersPerTick: number;
  maxActionsPerUser: number;
  minAp: number;
  inactiveDays: number;
};

type DungeonBatchJob = {
  userId: string;
};

@Injectable()
export class DungeonBatchService implements OnModuleInit {
  private readonly logger = new Logger(DungeonBatchService.name);
  private readonly config: BatchConfig;
  private lastCursorUserId?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dungeonEventService: DungeonEventService,
    private readonly lockService: DungeonBatchLockService,
    @Inject('DUNGEON_BATCH_QUEUE')
    private readonly queue: SimpleQueue<DungeonBatchJob>,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const fallbackEnv = configService ? undefined : loadEnvironment();

    this.config = {
      cron:
        this.configService?.get<string>('dungeon.batch.cron') ??
        fallbackEnv?.dungeonBatchCron ??
        '*/5 * * * *',
      maxUsersPerTick:
        this.configService?.get<number>('dungeon.batch.maxUsersPerTick') ??
        fallbackEnv?.dungeonBatchMaxUsersPerTick ??
        200,
      maxActionsPerUser:
        this.configService?.get<number>('dungeon.batch.maxActionsPerUser') ??
        fallbackEnv?.dungeonBatchMaxActionsPerUser ??
        5,
      minAp:
        this.configService?.get<number>('dungeon.batch.minAp') ??
        fallbackEnv?.dungeonBatchMinAp ??
        1,
      inactiveDays:
        this.configService?.get<number>('dungeon.batch.inactiveDays') ??
        fallbackEnv?.dungeonBatchInactiveDays ??
        30,
    };

    this.queue.registerHandler(async (job) => {
      await this.processUser(job.userId);
    });
  }

  onModuleInit(): void {
    if (!this.schedulerRegistry) {
      this.logger.warn(
        'SchedulerRegistry not available; skipping dungeon batch cron registration.',
      );
      return;
    }

    const job = new CronJob<null, null>(
      this.config.cron,
      () => {
        void this.runBatchTick();
      },
      null,
      false,
    );
    this.schedulerRegistry.addCronJob('dungeon-batch', job);
    job.start();
    this.logger.log(`Dungeon batch cron scheduled: ${this.config.cron}`);
  }

  async runBatchTick(): Promise<void> {
    const userIds = await this.fetchEligibleUsers();
    for (const userId of userIds) {
      await this.queue.enqueue({ userId });
    }
  }

  private async fetchEligibleUsers(): Promise<string[]> {
    const where: Prisma.DungeonStateWhereInput = {
      ap: { gte: this.config.minAp },
    };

    if (this.config.inactiveDays > 0) {
      const threshold = new Date(
        Date.now() - this.config.inactiveDays * 24 * 60 * 60 * 1000,
      );
      where.updatedAt = { gte: threshold };
    }

    const primary = await this.prisma.dungeonState.findMany({
      where,
      take: this.config.maxUsersPerTick,
      orderBy: { userId: 'asc' },
      ...(this.lastCursorUserId
        ? { cursor: { userId: this.lastCursorUserId }, skip: 1 }
        : {}),
      select: { userId: true },
    });

    if (primary.length === this.config.maxUsersPerTick) {
      this.lastCursorUserId = primary[primary.length - 1]?.userId;
      return primary.map((p) => p.userId);
    }

    const remaining = this.config.maxUsersPerTick - primary.length;
    const secondary =
      remaining > 0
        ? await this.prisma.dungeonState.findMany({
            where,
            take: remaining,
            orderBy: { userId: 'asc' },
            select: { userId: true },
          })
        : [];

    const combined = [...primary, ...secondary];
    this.lastCursorUserId = combined[combined.length - 1]?.userId;
    return combined.map((p) => p.userId);
  }

  private async processUser(userId: string): Promise<void> {
    const locked = await this.lockService.acquire(userId);
    if (!locked) {
      this.logger.warn(
        `Skipping dungeon batch for user ${userId}: lock not acquired`,
      );
      return;
    }

    try {
      const latestState = await this.prisma.dungeonState.findUnique({
        where: { userId },
      });
      if (!latestState || latestState.ap < this.config.minAp) {
        return;
      }

      let currentState = latestState;
      const allowedActions = Math.min(
        currentState.ap,
        this.config.maxActionsPerUser,
      );

      for (let i = 0; i < allowedActions; i += 1) {
        if (currentState.ap < this.config.minAp) {
          break;
        }

        const nextState = await this.runSingleAction(currentState);
        if (!nextState) {
          break;
        }
        currentState = nextState;
      }
    } catch (error) {
      this.logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Dungeon batch execution failed',
      );
    } finally {
      await this.lockService.release(userId);
    }
  }

  private async runSingleAction(
    state: DungeonState,
  ): Promise<DungeonState | null> {
    const result = await this.dungeonEventService.execute({
      state,
      seed: this.buildSeed(state),
      actionCounter: state.version,
      apCost: 1,
    });

    const persisted = await this.persistResult(state, result);
    if (!persisted) {
      this.logger.warn(
        `Skipping user ${state.userId} action: state version changed concurrently.`,
      );
      return null;
    }

    return persisted;
  }

  private async persistResult(
    stateBefore: DungeonState,
    result: DungeonEventResult,
  ): Promise<DungeonState | null> {
    return this.prisma.$transaction(async (tx) => {
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

  private buildSeed(state: DungeonState): string {
    return state.userId;
  }
}
