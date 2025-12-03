import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApSyncStatus, ApSyncTokenType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD } from './github.constants';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubGraphqlError, GithubSyncResponse } from './github.interfaces';
import { GithubSyncLockService } from './github-sync.lock.service';
import { GithubSyncService } from './github-sync.service';
import {
  buildMetaWithTotals,
  buildRateLimitMeta,
  extractContributionsFromCollection,
  getAnchorFromMeta,
  getLastContributionsTotal,
} from './github-sync.util';

interface SyncContext {
  userId: string;
  from: Date;
  to: Date;
}

const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class GithubManualSyncService {
  private readonly logger = new Logger(GithubManualSyncService.name);
  private readonly cooldownMs: number;
  private readonly rateLimitWarnRemaining: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly lockService: GithubSyncLockService,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.cooldownMs =
      this.configService?.get<number>('github.sync.manualCooldownMs') ??
      DEFAULT_COOLDOWN_MS;
    this.rateLimitWarnRemaining =
      this.configService?.get<number>(
        'github.sync.rateLimitFallbackRemaining',
      ) ?? DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD;
  }

  async syncNow(userId: string): Promise<GithubSyncResponse> {
    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'github' },
      select: { accountId: true, accessToken: true, updatedAt: true },
    });

    if (!account) {
      throw new BadRequestException({
        code: 'GITHUB_ACCOUNT_NOT_LINKED',
        message: 'GitHub 계정이 연결되어 있지 않습니다.',
      });
    }

    const login = await this.resolveLogin(account);
    if (!login) {
      throw new BadRequestException({
        code: 'GITHUB_ACCOUNT_LOGIN_NOT_FOUND',
        message:
          'GitHub 로그인명을 확인할 수 없습니다. 계정 연동을 다시 시도해주세요.',
      });
    }

    const now = new Date();
    const lastSuccess = await this.prisma.apSyncLog.findFirst({
      where: { userId, status: ApSyncStatus.SUCCESS },
      orderBy: { windowEnd: 'desc' },
      select: { windowStart: true, windowEnd: true, meta: true },
    });
    const baseFrom = account.updatedAt
      ? new Date(account.updatedAt.getTime() + 1)
      : new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
    const anchorFrom =
      getAnchorFromMeta(lastSuccess?.meta) ??
      lastSuccess?.windowStart ??
      this.startOfDayUtc(baseFrom);
    const from = anchorFrom;
    const to = now;

    const lastSyncAt = account.updatedAt ?? lastSuccess?.windowEnd ?? null;
    this.enforceCooldown(userId, lastSyncAt, now);

    const context: SyncContext = {
      userId,
      from,
      to,
    };

    const locked = await this.lockService.acquire(userId);
    if (!locked) {
      throw new HttpException(
        {
          error: {
            code: 'GITHUB_SYNC_IN_PROGRESS',
            message:
              '동일 사용자의 GitHub 동기화가 이미 실행 중입니다. 잠시 후 다시 시도해주세요.',
          },
        },
        HttpStatus.CONFLICT,
      );
    }

    try {
      const result = await this.client.fetchContributions<{
        rateLimit?: { remaining?: number; resetAt?: number };
        user?: {
          contributionsCollection?: {
            totalCommitContributions?: number;
            restrictedContributionsCount?: number;
            pullRequestContributions?: { totalCount?: number };
            pullRequestReviewContributions?: { totalCount?: number };
            issueContributions?: { totalCount?: number };
          };
        };
      }>(account.accessToken ?? null, {
        login,
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        cursor: null,
      });

      this.logger.log({
        message: 'result',
        result,
        from: context.from.toISOString(),
        to: context.to.toISOString(),
      });

      const contributionsTotal = extractContributionsFromCollection(
        result.data?.user?.contributionsCollection,
      );
      const prevTotal = getLastContributionsTotal(
        lastSuccess?.meta,
        anchorFrom,
      );
      const contributionsDelta = Math.max(contributionsTotal - prevTotal, 0);
      const tokenType =
        result.tokenType === 'pat'
          ? ApSyncTokenType.PAT
          : ApSyncTokenType.OAUTH;

      this.logger.log({
        message: 'Github manual sync window',
        userId,
        login,
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        lastSuccessAt: lastSuccess?.windowEnd?.toISOString() ?? null,
        accountUpdatedAt: account.updatedAt?.toISOString() ?? null,
        contributionsTotal,
        contributionsDelta,
        tokenType,
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
          message: 'GitHub manual sync rate limit is low',
          userId,
          remaining: result.rateLimit.remaining,
          resetAt: result.rateLimit.resetAt ?? null,
          tokenType,
          tokensTried: result.tokensTried,
          attempts: result.attempts ?? 1,
          threshold: this.rateLimitWarnRemaining,
        });
      }

      const meta = buildMetaWithTotals(
        result.rateLimit,
        contributionsTotal,
        anchorFrom,
        {
          tokensTried: result.tokensTried,
          attempts: result.attempts,
          backoffMs: result.backoffMs,
        },
      );
      const syncResult = await this.syncService.applyContributionSync({
        userId,
        contributions: contributionsDelta,
        windowStart: context.from,
        windowEnd: context.to,
        tokenType,
        rateLimitRemaining: result.rateLimit?.remaining,
        cursor: null,
        meta,
      });

      return {
        apDelta: syncResult.apDelta,
        contributions: contributionsDelta,
        windowStart: context.from.toISOString(),
        windowEnd: context.to.toISOString(),
        tokenType,
        rateLimitRemaining: result.rateLimit?.remaining,
        logId: syncResult.log.id,
        meta,
      };
    } catch (error) {
      if (error instanceof GithubGraphqlError) {
        if (error.code === 'RATE_LIMITED') {
          await this.recordFailure(context, {
            errorCode: 'GITHUB_SYNC_RATE_LIMITED',
            rateLimit: error.rateLimit,
          });
          throw new HttpException(
            {
              error: {
                code: 'GITHUB_SYNC_RATE_LIMITED',
                message:
                  'GitHub 레이트 리밋이 소진되었습니다. 잠시 후 다시 시도해주세요.',
                details: buildRateLimitMeta(error.rateLimit) ?? undefined,
              },
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        await this.recordFailure(context, {
          errorCode: `GITHUB_SYNC_${error.code}`,
          rateLimit: error.rateLimit,
        });
      } else {
        await this.recordFailure(context, {
          errorCode: 'GITHUB_SYNC_UNKNOWN_ERROR',
        });
      }

      this.logger.error(
        `Github manual sync failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException({
        code: 'GITHUB_SYNC_FAILED',
        message: 'GitHub 동기화에 실패했습니다.',
      });
    } finally {
      await this.lockService.release(userId);
    }
  }

  private enforceCooldown(
    userId: string,
    lastSyncAt: Date | null | undefined,
    now: Date,
  ): void {
    if (!lastSyncAt) return;

    // windowEnd가 현재보다 미래일 수 있으므로 now로 클램프
    const lastEffective =
      lastSyncAt.getTime() > now.getTime() ? now : lastSyncAt;

    const elapsed = now.getTime() - lastEffective.getTime();
    if (elapsed < this.cooldownMs) {
      throw new HttpException(
        {
          error: {
            code: 'GITHUB_SYNC_TOO_FREQUENT',
            message:
              '최근 동기화가 실행되어 수동 동기화를 잠시 후에만 수행할 수 있습니다.',
            details: {
              lastSyncedAt: lastEffective.toISOString(),
              retryAfterMs: Math.max(this.cooldownMs - elapsed, 0),
            },
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private startOfDayUtc(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async recordFailure(
    context: SyncContext,
    options: {
      errorCode: string;
      rateLimit?: { remaining?: number; resetAt?: number; resource?: string };
    },
  ): Promise<void> {
    const meta = options.rateLimit && buildRateLimitMeta(options.rateLimit);

    await this.prisma.apSyncLog.upsert({
      where: {
        userId_windowStart_windowEnd: {
          userId: context.userId,
          windowStart: context.from,
          windowEnd: context.to,
        },
      },
      update: {
        contributions: 0,
        apDelta: 0,
        tokenType: ApSyncTokenType.OAUTH,
        rateLimitRemaining: options.rateLimit?.remaining,
        cursor: null,
        meta: meta ?? Prisma.JsonNull,
        status: ApSyncStatus.FAILED,
        errorCode: options.errorCode,
      },
      create: {
        userId: context.userId,
        windowStart: context.from,
        windowEnd: context.to,
        contributions: 0,
        apDelta: 0,
        tokenType: ApSyncTokenType.OAUTH,
        rateLimitRemaining: options.rateLimit?.remaining,
        cursor: null,
        meta: meta ?? Prisma.JsonNull,
        status: ApSyncStatus.FAILED,
        errorCode: options.errorCode,
      },
    });
  }

  private async resolveLogin(account: {
    accountId: string;
    accessToken?: string | null;
  }): Promise<string | null> {
    // accountId에 영문자가 포함돼 있으면 로그인명으로 취급
    if (account.accountId && /[A-Za-z]/.test(account.accountId)) {
      return account.accountId;
    }

    // 숫자 ID만 있는 경우 토큰으로 viewer.login 조회
    const viewerLogin = await this.client.fetchViewerLogin(account.accessToken);
    return viewerLogin ?? null;
  }
}
