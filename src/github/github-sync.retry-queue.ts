import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Queue,
  Worker,
  JobsOptions,
  QueueEvents,
  Job,
  type DefaultJobOptions,
} from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ApSyncStatus, ApSyncTokenType } from '@prisma/client';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubSyncService } from './github-sync.service';
import { GithubSyncLockService } from './github-sync.lock.service';
import {
  buildMetaWithTotals,
  extractContributionsFromCollection,
  getAnchorFromMeta,
  getLastContributionsTotal,
} from './github-sync.util';
import { loadEnvironment } from '../config/environment';

type RetryJobData = {
  userId: string;
  reason: string;
  resetAt?: number | null;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 60_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONCURRENCY = 5;

class NonRetryableError extends Error {}

@Injectable()
export class GithubSyncRetryQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GithubSyncRetryQueue.name);
  private queue?: Queue<RetryJobData>;
  private worker?: Worker<RetryJobData>;
  private events?: QueueEvents;
  private connection?: IORedis;

  private readonly redisUrl: string;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly ttlMs: number;
  private readonly concurrency: number;
  private readonly skipConnection: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly lockService: GithubSyncLockService,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    const nodeEnv =
      this.configService?.get<string>('nodeEnv') ??
      process.env.NODE_ENV ??
      'development';
    this.redisUrl =
      this.configService?.get<string>('redis.url') ??
      fallbackEnv?.redisUrl ??
      'redis://localhost:6379';
    this.maxRetries =
      this.configService?.get<number>('github.sync.retryMax') ??
      fallbackEnv?.githubSyncRetryMax ??
      DEFAULT_MAX_RETRIES;
    this.backoffBaseMs =
      this.configService?.get<number>('github.sync.retryBackoffBaseMs') ??
      fallbackEnv?.githubSyncRetryBackoffBaseMs ??
      DEFAULT_BACKOFF_MS;
    this.ttlMs =
      this.configService?.get<number>('github.sync.retryTtlMs') ??
      fallbackEnv?.githubSyncRetryTtlMs ??
      DEFAULT_TTL_MS;
    this.concurrency =
      this.configService?.get<number>('github.sync.retryConcurrency') ??
      fallbackEnv?.githubSyncRetryConcurrency ??
      DEFAULT_CONCURRENCY;
    this.skipConnection =
      this.configService?.get<boolean>('redis.skipConnection') ??
      fallbackEnv?.redisSkipConnection ??
      nodeEnv === 'test';
  }

  async onModuleInit(): Promise<void> {
    if (this.skipConnection) {
      this.logger.warn('Redis connection skipped by configuration.');
      return;
    }

    this.connection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    const defaultJobOptions: DefaultJobOptions = {
      attempts: this.maxRetries,
      backoff: { type: 'exponential', delay: this.backoffBaseMs },
      removeOnComplete: true,
      removeOnFail: false,
    };

    this.queue = new Queue<RetryJobData>('github-sync-retry', {
      connection: this.connection,
      defaultJobOptions,
    });

    this.events = new QueueEvents('github-sync-retry', {
      connection: this.connection,
    });
    this.events.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(
        { jobId, failedReason },
        'GitHub sync retry job failed',
      );
    });

    this.worker = new Worker<RetryJobData>(
      'github-sync-retry',
      async (job) => this.handleJob(job),
      {
        connection: this.connection,
        concurrency: this.concurrency,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        {
          jobId: job?.id,
          userId: job?.data.userId,
          attemptsMade: job?.attemptsMade,
          failedReason: err?.message,
        },
        'GitHub sync retry worker failed',
      );
    });

    this.worker.on('completed', (job) => {
      this.logger.log({
        message: 'GitHub sync retry completed',
        jobId: job.id,
        userId: job.data.userId,
        attemptsMade: job.attemptsMade,
      });
    });

    if (this.queue && this.worker && this.events) {
      await Promise.all([
        this.queue.waitUntilReady(),
        this.worker.waitUntilReady(),
        this.events.waitUntilReady(),
      ]);
    }

    this.logger.log('GitHub sync retry queue initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.events?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueue(
    data: RetryJobData,
    opts?: Partial<JobsOptions>,
  ): Promise<void> {
    if (!this.queue) return;

    const existing = await this.queue.getJob(data.userId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'failed' && state !== 'completed') {
        this.logger.warn(
          {
            userId: data.userId,
            reason: data.reason,
            state,
          },
          'Retry job already queued; skipping duplicate enqueue',
        );
        return;
      }

      try {
        await existing.remove();
      } catch (error) {
        this.logger.warn(
          {
            userId: data.userId,
            state,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to remove completed/failed retry job before re-enqueue',
        );
      }
    }

    const delay =
      data.resetAt && data.resetAt > Date.now()
        ? data.resetAt - Date.now()
        : this.backoffBaseMs;

    try {
      await this.queue.add('github-sync-retry', data, {
        jobId: data.userId,
        delay,
        attempts: this.maxRetries,
        backoff: { type: 'exponential', delay: this.backoffBaseMs },
        removeOnComplete: true,
        removeOnFail: false,
        ...(opts as JobsOptions),
      } as JobsOptions);
      this.logger.log({
        message: 'Enqueued GitHub sync retry job',
        userId: data.userId,
        reason: data.reason,
        delay,
      });
    } catch (error) {
      this.logger.warn(
        {
          userId: data.userId,
          reason: data.reason,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to enqueue GitHub sync retry job',
      );
    }
  }

  private async handleJob(job: Job<RetryJobData>): Promise<void> {
    const { userId } = job.data;

    if (Date.now() - job.timestamp > this.ttlMs) {
      this.logger.warn(
        { userId, jobId: job.id, ttlMs: this.ttlMs },
        'Dropping expired GitHub sync retry job due to TTL',
      );
      job.discard();
      return;
    }

    const locked = await this.lockService.acquire(userId);
    if (!locked) {
      throw new Error('LOCK_NOT_ACQUIRED');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          accounts: {
            where: { providerId: 'github' },
            select: { accountId: true, accessToken: true, updatedAt: true },
          },
        },
      });

      const account = user?.accounts[0];
      if (!user || !account) {
        throw new NonRetryableError('GITHUB_ACCOUNT_NOT_LINKED');
      }

      const now = new Date();
      const lastSuccess = await this.prisma.apSyncLog.findFirst({
        where: { userId, status: ApSyncStatus.SUCCESS },
        orderBy: { windowEnd: 'desc' },
        select: { windowStart: true, windowEnd: true, meta: true },
      });

      const baseFrom = account.updatedAt
        ? new Date(account.updatedAt.getTime() + 1)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const anchorFrom =
        getAnchorFromMeta(lastSuccess?.meta) ??
        lastSuccess?.windowStart ??
        this.startOfDayUtc(baseFrom);
      const from = anchorFrom;
      const to = now;
      const login = await this.resolveLogin(account);
      if (!login) {
        throw new NonRetryableError('GITHUB_LOGIN_NOT_FOUND');
      }
      const accessToken = account.accessToken ?? null;

      const result = await this.client.fetchContributions<{
        rateLimit?: {
          remaining?: number;
          resetAt?: number;
        };
        user?: {
          contributionsCollection?: {
            totalCommitContributions?: number;
            restrictedContributionsCount?: number;
            pullRequestContributions?: { totalCount?: number };
            pullRequestReviewContributions?: { totalCount?: number };
            issueContributions?: { totalCount?: number };
          };
        };
      }>(accessToken, {
        login,
        from: from.toISOString(),
        to: to.toISOString(),
        cursor: null,
      });

      const contributionsTotal = extractContributionsFromCollection(
        result.data?.user?.contributionsCollection,
      );
      const prevTotal = getLastContributionsTotal(
        lastSuccess?.meta,
        anchorFrom,
      );
      const contributions = Math.max(contributionsTotal - prevTotal, 0);
      const tokenType =
        result.tokenType === 'pat'
          ? ApSyncTokenType.PAT
          : ApSyncTokenType.OAUTH;

      await this.syncService.applyContributionSync({
        userId,
        contributions,
        windowStart: from,
        windowEnd: to,
        tokenType,
        rateLimitRemaining: result.rateLimit?.remaining,
        cursor: null,
        meta: buildMetaWithTotals(
          result.rateLimit,
          contributionsTotal,
          anchorFrom,
          {
            tokensTried: result.tokensTried,
            attempts: result.attempts,
            backoffMs: result.backoffMs,
          },
        ),
      });
    } catch (error) {
      if (error instanceof NonRetryableError) {
        this.logger.warn(
          {
            userId,
            reason: error.message,
          },
          'Non-retryable GitHub sync error; discarding job',
        );
        job.discard();
        return;
      }
      throw error;
    } finally {
      await this.lockService.release(userId);
    }
  }

  private startOfDayUtc(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async resolveLogin(account: {
    accountId: string;
    accessToken?: string | null;
  }): Promise<string | null> {
    if (account.accountId && /[A-Za-z]/.test(account.accountId)) {
      return account.accountId;
    }

    const viewerLogin = await this.client.fetchViewerLogin(account.accessToken);
    return viewerLogin ?? null;
  }
}
