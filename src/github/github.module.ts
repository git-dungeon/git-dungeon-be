import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DEFAULT_GITHUB_GRAPHQL_ENDPOINT,
  DEFAULT_GITHUB_GRAPHQL_USER_AGENT,
  GITHUB_GRAPHQL_OPTIONS,
} from './github.constants';
import { GithubGraphqlClient } from './github-graphql.client';
import { GithubGraphqlClientOptions } from './github.interfaces';

type GithubSyncConfig = {
  pat: string | null;
  endpoint?: string;
  userAgent?: string;
  rateLimitFallbackRemaining?: number;
};

@Module({
  imports: [ConfigModule],
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
          rateLimitThreshold: syncConfig?.rateLimitFallbackRemaining,
        };
      },
    },
    GithubGraphqlClient,
  ],
  exports: [GithubGraphqlClient],
})
export class GithubModule {}
