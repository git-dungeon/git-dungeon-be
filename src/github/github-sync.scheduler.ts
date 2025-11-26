import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubSyncService } from './github-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApSyncTokenType } from '@prisma/client';
import { loadEnvironment } from '../config/environment';

@Injectable()
export class GithubSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(GithubSyncScheduler.name);
  private readonly cronExpr: string;
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GithubGraphqlClient,
    private readonly syncService: GithubSyncService,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    this.cronExpr =
      this.configService?.get<string>('github.sync.cron') ??
      fallbackEnv?.githubSyncCron ??
      '0 */10 * * * *';
    this.batchSize =
      this.configService?.get<number>('github.sync.batchSize', 50) ??
      fallbackEnv?.githubSyncBatchSize ??
      50;
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
    const users = await this.prisma.user.findMany({
      where: { accounts: { some: { providerId: 'github' } } },
      take: this.batchSize,
      include: {
        accounts: {
          where: { providerId: 'github' },
          select: { accountId: true, accessToken: true, updatedAt: true },
        },
      },
    });

    const now = new Date();

    for (const user of users) {
      const account = user.accounts[0];
      if (!account) continue;

      const from =
        account.updatedAt ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // fallback 최근 7일
      const to = now;
      const login = account.accountId;
      const accessToken = account.accessToken ?? null;

      try {
        // TODO: 실제 기여 수/커서 계산 로직 보강 필요
        const result = await this.client.fetchContributions<{
          rateLimit?: { remaining?: number };
        }>(accessToken, {
          login,
          from: from.toISOString(),
          to: to.toISOString(),
          cursor: null,
        });

        const contributions = 0; // placeholder, 추후 result 데이터 파싱 필요

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
          meta: result.rateLimit
            ? {
                remaining: result.rateLimit.remaining ?? null,
                resetAt: result.rateLimit.resetAt ?? null,
                resource: result.rateLimit.resource ?? null,
              }
            : null,
        });
      } catch (error) {
        this.logger.error(
          `Github sync failed for user ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
