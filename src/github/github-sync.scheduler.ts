import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubSyncLockService } from './github-sync.lock.service';
import { GithubSyncRetryQueue } from './github-sync.retry-queue';
import { GithubSyncService } from './github-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApSyncStatus, ApSyncTokenType } from '@prisma/client';
import { loadEnvironment } from '../config/environment';
import { DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD } from './github.constants';
import {
  buildMetaWithTotals,
  extractContributionsFromCollection,
  getAnchorFromMeta,
  getLastContributionsTotal,
} from './github-sync.util';

@Injectable()
export class GithubSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(GithubSyncScheduler.name);
  private readonly cronExpr: string;
  private readonly batchSize: number;
  private readonly rateLimitWarnRemaining: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly lockService: GithubSyncLockService,
    private readonly retryQueue: GithubSyncRetryQueue,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    this.cronExpr =
      this.configService?.get<string>('github.sync.cron') ??
      fallbackEnv?.githubSyncCron ??
      '0 0 0 * * *';
    this.batchSize =
      this.configService?.get<number>('github.sync.batchSize', 50) ??
      fallbackEnv?.githubSyncBatchSize ??
      50;
    this.rateLimitWarnRemaining =
      this.configService?.get<number>(
        'github.sync.rateLimitFallbackRemaining',
      ) ??
      fallbackEnv?.githubSyncRateLimitFallbackRemaining ??
      DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD;
  }

  private startOfDayUtc(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  onModuleInit(): void {
    if (!this.schedulerRegistry) {
      this.logger.warn(
        'SchedulerRegistry not available; skipping cron job registration.',
      );
      return;
    }

    const job = new CronJob<null, null>(
      this.cronExpr,
      () => {
        void this.handleSyncJob();
      },
      null,
      false,
    );
    this.schedulerRegistry.addCronJob('github-sync', job);
    job.start();
    this.logger.log(`GitHub sync cron scheduled: ${this.cronExpr}`);
  }

  async handleSyncJob(): Promise<void> {
    let cursor: { id: string } | undefined;
    let lastCursorId: string | undefined;
    const now = new Date();

    while (true) {
      const users = await this.prisma.user.findMany({
        where: { accounts: { some: { providerId: 'github' } } },
        orderBy: { id: 'asc' },
        take: this.batchSize,
        skip: cursor ? 1 : 0,
        cursor,
        include: {
          accounts: {
            where: { providerId: 'github' },
            select: { accountId: true, accessToken: true, updatedAt: true },
          },
        },
      });

      if (users.length === 0) break;

      for (const user of users) {
        const account = user.accounts[0];
        if (!account) continue;

        const locked = await this.lockService.acquire(user.id);
        if (!locked) {
          this.logger.warn(
            `Skipping GitHub sync for user ${user.id}: another sync is in progress (lock not acquired).`,
          );
          continue;
        }
        let hasLock = true;

        try {
          const lastSuccess = await this.prisma.apSyncLog.findFirst({
            where: { userId: user.id, status: ApSyncStatus.SUCCESS },
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
            this.logger.warn(
              `Skipping GitHub sync for user ${user.id}: unable to resolve login from accountId=${account.accountId}`,
            );
            await this.lockService.release(user.id);
            hasLock = false;
            continue;
          }
          const accessToken = account.accessToken ?? null;

          try {
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

            this.logger.log({
              message: 'Github scheduled sync window',
              userId: user.id,
              login,
              from: from.toISOString(),
              to: to.toISOString(),
              lastSuccessAt: lastSuccess?.windowEnd?.toISOString() ?? null,
              accountUpdatedAt: account.updatedAt?.toISOString() ?? null,
              contributionsTotal,
              contributionsDelta: contributions,
              tokenType:
                result.tokenType === 'pat'
                  ? ApSyncTokenType.PAT
                  : ApSyncTokenType.OAUTH,
              rateLimit: result.rateLimit,
              tokensTried: result.tokensTried,
              attempts: result.attempts ?? 1,
              backoffMs: result.backoffMs ?? 0,
              rawData: result.data,
            });

            if (
              typeof result.rateLimit?.remaining === 'number' &&
              result.rateLimit.remaining <= this.rateLimitWarnRemaining
            ) {
              this.logger.warn({
                message: 'GitHub scheduled sync rate limit is low',
                userId: user.id,
                remaining: result.rateLimit.remaining,
                resetAt: result.rateLimit.resetAt ?? null,
                tokenType: result.tokenType,
                tokensTried: result.tokensTried,
                attempts: result.attempts ?? 1,
                threshold: this.rateLimitWarnRemaining,
              });
            }

            await this.syncService.applyContributionSync({
              userId: user.id,
              contributions,
              windowStart: from,
              windowEnd: to,
              tokenType:
                result.tokenType === 'pat'
                  ? ApSyncTokenType.PAT
                  : ApSyncTokenType.OAUTH,
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
            if (error instanceof Error) {
              this.logger.error(
                {
                  userId: user.id,
                  code: (error as { code?: string }).code,
                  status: (error as { status?: number }).status,
                  rateLimit: (error as { rateLimit?: unknown }).rateLimit,
                  cause: (error as { cause?: unknown }).cause,
                },
                `Github sync failed for user ${user.id}: ${error.message}`,
              );
              const resetAt = (error as { rateLimit?: { resetAt?: number } })
                .rateLimit?.resetAt;
              if (this.isRetryable(error)) {
                await this.retryQueue.enqueue({
                  userId: user.id,
                  reason: (error as { code?: string }).code ?? 'UNKNOWN',
                  resetAt: resetAt ?? undefined,
                });
              }
            } else {
              this.logger.error(
                { userId: user.id, error: String(error) },
                `Github sync failed for user ${user.id}`,
              );
            }
          } finally {
            if (hasLock) {
              await this.lockService.release(user.id);
              hasLock = false;
            }
          }
        } catch (error) {
          this.logger.warn(
            { userId: user.id, error: (error as Error).message },
            'Unexpected error outside sync try block',
          );
          if (hasLock) {
            await this.lockService.release(user.id);
            hasLock = false;
          }
        }
      }

      const last = users[users.length - 1];
      if (!last || last.id === lastCursorId) {
        break;
      }
      lastCursorId = last.id;
      cursor = { id: last.id };
      if (users.length < this.batchSize) {
        break;
      }
    }
  }

  private async resolveLogin(account: {
    accountId: string;
    accessToken?: string | null;
  }): Promise<string | null> {
    // 계정에 저장된 accountId가 GitHub 로그인(문자 포함)이면 그대로 사용
    if (account.accountId && /[A-Za-z]/.test(account.accountId)) {
      return account.accountId;
    }

    // 숫자 ID만 있는 경우 accessToken으로 viewer.login을 조회
    const viewerLogin = await this.client.fetchViewerLogin(account.accessToken);
    return viewerLogin ?? null;
  }

  private isRetryable(error: unknown): boolean {
    const code = (error as { code?: string }).code;
    return (
      code === 'RATE_LIMITED' ||
      code === 'HTTP_ERROR' ||
      code === 'MAX_ATTEMPTS'
    );
  }
}
