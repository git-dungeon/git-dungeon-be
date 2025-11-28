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
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubGraphqlError, GithubSyncResponse } from './github.interfaces';
import { GithubSyncService } from './github-sync.service';

interface SyncContext {
  userId: string;
  from: Date;
  to: Date;
}

const ONE_MINUTE_MS = 60_000;
const DEFAULT_COOLDOWN_MS = ONE_MINUTE_MS;
const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class GithubManualSyncService {
  private readonly logger = new Logger(GithubManualSyncService.name);
  private readonly cooldownMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.cooldownMs =
      this.configService?.get<number>('github.sync.manualCooldownMs') ??
      DEFAULT_COOLDOWN_MS;
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

    const now = new Date();
    this.enforceCooldown(userId, account.updatedAt, now);

    const context: SyncContext = {
      userId,
      from: account.updatedAt ?? new Date(now.getTime() - DEFAULT_LOOKBACK_MS), // 최근 7일 기본 윈도우
      to: now,
    };

    try {
      const result = await this.client.fetchContributions<{
        rateLimit?: { remaining?: number; resetAt?: number; resource?: string };
        user?: {
          contributionsCollection?: {
            commitContributionsByRepository?: { totalCount?: number };
          };
        };
      }>(account.accessToken ?? null, {
        login: account.accountId,
        from: context.from.toISOString(),
        to: context.to.toISOString(),
        cursor: null,
      });

      const contributions = this.extractContributions(result.data);
      const tokenType =
        result.tokenType === 'pat'
          ? ApSyncTokenType.PAT
          : ApSyncTokenType.OAUTH;

      const meta = result.rateLimit && this.toRateLimitMeta(result.rateLimit);
      const syncResult = await this.syncService.applyContributionSync({
        userId,
        contributions,
        windowStart: context.from,
        windowEnd: context.to,
        tokenType,
        rateLimitRemaining: result.rateLimit?.remaining,
        cursor: null,
        meta: meta ?? Prisma.JsonNull,
      });

      return {
        apDelta: syncResult.apDelta,
        contributions,
        windowStart: context.from.toISOString(),
        windowEnd: context.to.toISOString(),
        tokenType,
        rateLimitRemaining: result.rateLimit?.remaining,
        logId: syncResult.log.id,
        meta: result.rateLimit ? this.toRateLimitMeta(result.rateLimit) : null,
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
                details: this.toRateLimitMeta(error.rateLimit ?? {}),
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
    }
  }

  private enforceCooldown(
    userId: string,
    lastSyncAt: Date | null | undefined,
    now: Date,
  ): void {
    const lastSuccessfulSyncAt = lastSyncAt;

    if (
      lastSuccessfulSyncAt &&
      now.getTime() - lastSuccessfulSyncAt.getTime() < MIN_SYNC_INTERVAL_MS
    ) {
      throw new HttpException(
        {
          error: {
            code: 'GITHUB_SYNC_TOO_FREQUENT',
            message:
              '최근 6시간 내 동기화가 실행되어 수동 동기화를 잠시 후에만 수행할 수 있습니다.',
            details: {
              lastSyncedAt: lastSuccessfulSyncAt.toISOString(),
              retryAfterMs:
                MIN_SYNC_INTERVAL_MS -
                (now.getTime() - lastSuccessfulSyncAt.getTime()),
            },
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private extractContributions(data: unknown): number {
    if (typeof data !== 'object' || data === null) {
      return 0;
    }

    const candidate = data as {
      user?: {
        contributionsCollection?: {
          commitContributionsByRepository?: { totalCount?: unknown };
        };
      };
    };

    const total =
      candidate.user?.contributionsCollection?.commitContributionsByRepository
        ?.totalCount;

    return typeof total === 'number' ? total : 0;
  }

  private async recordFailure(
    context: SyncContext,
    options: {
      errorCode: string;
      rateLimit?: { remaining?: number; resetAt?: number; resource?: string };
    },
  ): Promise<void> {
    const meta = options.rateLimit && this.toRateLimitMeta(options.rateLimit);

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

  private toRateLimitMeta(input: {
    remaining?: number;
    resetAt?: number | string;
    resource?: string;
  }): {
    remaining: number | null;
    resetAt: number | null;
    resource: string | null;
  } {
    const resetAt =
      typeof input.resetAt === 'string'
        ? Number(new Date(input.resetAt).getTime())
        : (input.resetAt ?? null);

    return {
      remaining: typeof input.remaining === 'number' ? input.remaining : null,
      resetAt: typeof resetAt === 'number' ? resetAt : null,
      resource: typeof input.resource === 'string' ? input.resource : null,
    };
  }
}
