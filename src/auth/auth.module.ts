import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_CONFIG_TOKEN, BETTER_AUTH_TOKEN } from './auth.constants.js';
import type { AuthConfig } from './auth.interfaces.js';

const DEFAULT_GITHUB_SCOPE = ['read:user', 'user:email'] as const;

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: AUTH_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): AuthConfig => {
        const clientId = configService.get<string>('auth.github.clientId');
        const clientSecret = configService.get<string>(
          'auth.github.clientSecret',
        );
        const redirectUri = configService.get<string>(
          'auth.github.redirectUri',
        );
        const scopeFromConfig =
          configService.get<string[]>('auth.github.scope') ?? [];

        const missing: string[] = [];
        if (!clientId) missing.push('auth.github.clientId');
        if (!clientSecret) missing.push('auth.github.clientSecret');
        if (!redirectUri) missing.push('auth.github.redirectUri');

        if (missing.length > 0) {
          throw new Error(
            `[AuthModule] missing configuration: ${missing.join(', ')}`,
          );
        }

        const normalizedScope =
          scopeFromConfig.length > 0
            ? scopeFromConfig
            : [...DEFAULT_GITHUB_SCOPE];

        return {
          github: {
            clientId: clientId!,
            clientSecret: clientSecret!,
            redirectUri: redirectUri!,
            scope: normalizedScope,
          },
        };
      },
    },
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [AUTH_CONFIG_TOKEN, PrismaService],
      useFactory: (authConfig: AuthConfig, prismaService: PrismaService) => {
        return betterAuth({
          appName: 'Git Dungeon',
          basePath: '/api/auth',
          database: prismaAdapter(prismaService, {
            provider: 'postgresql',
          }),
          socialProviders: {
            github: {
              clientId: authConfig.github.clientId,
              clientSecret: authConfig.github.clientSecret,
              scope: authConfig.github.scope,
            },
          },
        });
      },
    },
  ],
  exports: [AUTH_CONFIG_TOKEN, BETTER_AUTH_TOKEN],
})
export class AuthModule {}
