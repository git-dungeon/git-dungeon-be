import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { SimpleQueue } from '../common/queue/simple-queue';

type RetryJobPayload = {
  userId: string;
  reason: string;
  resetAt?: number | null;
};

type RetryJobData = RetryJobPayload & {
  enqueuedAt: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 60_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONCURRENCY = 5;

class NonRetryableError extends Error {}

@Injectable()
export class GithubSyncRetryQueue {
  private readonly logger = new Logger(GithubSyncRetryQueue.name);
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly ttlMs: number;
  private readonly queue: SimpleQueue<RetryJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly lockService: GithubSyncLockService,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    this.maxRetries =
      this.configService?.get<number>('github.sync.retryMax') ??
      fallbackEnv?.queueRetryMax ??
      DEFAULT_MAX_RETRIES;
    this.backoffBaseMs =
      this.configService?.get<number>('github.sync.retryBackoffBaseMs') ??
      fallbackEnv?.queueRetryBackoffBaseMs ??
      DEFAULT_BACKOFF_MS;
    this.ttlMs =
      this.configService?.get<number>('github.sync.retryTtlMs') ??
      fallbackEnv?.queueRetryTtlMs ??
      DEFAULT_TTL_MS;

    this.queue = new SimpleQueue<RetryJobData>(
      'github-sync-retry',
      configService,
    );

    this.queue.registerHandler(async (job) => this.handleJob(job), {
      concurrency:
        this.configService?.get<number>('github.sync.retryConcurrency') ??
        fallbackEnv?.queueRetryConcurrency ??
        DEFAULT_CONCURRENCY,
    });
  }

  async enqueue(
    data: RetryJobPayload,
    opts?: { delayMs?: number },
  ): Promise<void> {
    const jobData: RetryJobData = {
      ...data,
      enqueuedAt: Date.now(),
    };

    const delay =
      jobData.resetAt && jobData.resetAt > Date.now()
        ? jobData.resetAt - Date.now()
        : this.backoffBaseMs;

    try {
      await this.queue.enqueue(jobData, {
        delayMs: opts?.delayMs ?? delay,
        jobId: jobData.userId,
      });
      this.logger.log({
        message: 'Enqueued GitHub sync retry job',
        userId: jobData.userId,
        reason: jobData.reason,
        delay,
      });
    } catch (error) {
      this.logger.warn(
        {
          userId: jobData.userId,
          reason: jobData.reason,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to enqueue GitHub sync retry job',
      );
    }
  }

  private async handleJob(job: RetryJobData): Promise<void> {
    const { userId } = job;

    if (Date.now() - job.enqueuedAt > this.ttlMs) {
      this.logger.warn(
        { userId, ttlMs: this.ttlMs },
        'Dropping expired GitHub sync retry job due to TTL',
      );
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
