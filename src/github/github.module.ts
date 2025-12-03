import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DEFAULT_GITHUB_GRAPHQL_ENDPOINT,
  DEFAULT_GITHUB_GRAPHQL_USER_AGENT,
  GITHUB_GRAPHQL_OPTIONS,
} from './github.constants';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubGraphqlClientOptions } from './github.interfaces';
import { GithubSyncService } from './github-sync.service';
import { GithubSyncScheduler } from './github-sync.scheduler';
import { GithubSyncController } from './github-sync.controller';
import { GithubManualSyncService } from './github-sync.manual.service';
import { GithubSyncRetryQueue } from './github-sync.retry-queue';
import { GithubSyncLockService } from './github-sync.lock.service';
import { GithubTokenGuard } from './github-token.guard';
import { AuthModule } from '../auth/auth.module';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';

type GithubSyncConfig = {
  pat: string | null;
  pats: string[];
  endpoint?: string;
  userAgent?: string;
  rateLimitFallbackRemaining?: number;
};

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [GithubSyncController],
  providers: [
    {
      provide: GITHUB_GRAPHQL_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GithubGraphqlClientOptions => {
        const syncConfig = config.get<GithubSyncConfig>('github.sync', {
          infer: true,
        }) as GithubSyncConfig | undefined;

        return {
          endpoint: syncConfig?.endpoint ?? DEFAULT_GITHUB_GRAPHQL_ENDPOINT,
          userAgent: syncConfig?.userAgent ?? DEFAULT_GITHUB_GRAPHQL_USER_AGENT,
          patToken: syncConfig?.pat ?? null,
          patTokens: syncConfig?.pats ?? [],
          rateLimitThreshold: syncConfig?.rateLimitFallbackRemaining,
        };
      },
    },
    GithubGraphqlClient,
    GithubTokenGuard,
    GithubSyncLockService,
    GithubSyncRetryQueue,
    GithubSyncService,
    GithubSyncScheduler,
    GithubManualSyncService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'GITHUB_SYNC_TOO_FREQUENT',
        message: '수동 동기화가 너무 잦습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
  exports: [GithubGraphqlClient, GithubSyncService],
})
export class GithubModule {}
