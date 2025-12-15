import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { betterAuth, generateId as betterAuthGenerateId } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG_TOKEN, BETTER_AUTH_TOKEN } from './auth.constants';
import type { AuthConfig } from './auth.interfaces';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthGuard } from './guards/auth.guard';
import { randomUUID } from 'crypto';

const DEFAULT_GITHUB_SCOPE = ['read:user', 'user:email'] as const;

const BETTER_AUTH_UUID_ID_MODELS = new Set([
  'user',
  'account',
  'session',
  'verification',
]);

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController, AuthSessionController],
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
        const rawAllowedOrigins =
          configService.get<string[]>('app.cors.allowedOrigins') ?? [];
        const normalizedAllowedOrigins = Array.from(
          new Set(
            rawAllowedOrigins
              .filter(
                (origin) =>
                  typeof origin === 'string' && origin.trim().length > 0,
              )
              .filter((origin) => origin !== '*')
              .map((origin) => {
                try {
                  return new URL(origin).origin;
                } catch {
                  return origin;
                }
              }),
          ),
        );
        const rawPublicBaseUrl = configService.get<string>('app.publicBaseUrl');

        const missing: string[] = [];
        if (!clientId) missing.push('auth.github.clientId');
        if (!clientSecret) missing.push('auth.github.clientSecret');
        if (!redirectUri) missing.push('auth.github.redirectUri');
        if (!rawPublicBaseUrl) missing.push('app.publicBaseUrl');

        if (missing.length > 0) {
          throw new Error(
            `[AuthModule] missing configuration: ${missing.join(', ')}`,
          );
        }

        let normalizedPublicBaseUrl: string | undefined;
        if (rawPublicBaseUrl) {
          try {
            normalizedPublicBaseUrl = new URL(rawPublicBaseUrl).origin;
          } catch {
            throw new Error(
              '[AuthModule] invalid configuration: app.publicBaseUrl must be a valid absolute URL',
            );
          }
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
          redirect: {
            allowedOrigins: normalizedAllowedOrigins,
          },
          publicBaseUrl: normalizedPublicBaseUrl!,
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
          advanced: {
            database: {
              generateId: ({ model, size }) => {
                // better-auth는 이 훅을 두 용도로 사용한다.
                // - DB "id" 생성(모델별 PK): UUID 타입 컬럼과 호환되어야 하므로 항상 UUID를 반환한다.
                // - 길이 지정이 필요한 토큰/코드 생성(size 제공): length 계약을 맞추기 위해 better-auth 기본 generator를 사용한다.
                const normalizedModel =
                  typeof model === 'string' ? model.toLowerCase() : '';
                if (BETTER_AUTH_UUID_ID_MODELS.has(normalizedModel)) {
                  return randomUUID();
                }
                if (typeof size === 'number') {
                  return betterAuthGenerateId(size);
                }
                return randomUUID();
              },
            },
          },
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
    AuthService,
    AuthSessionService,
    AuthGuard,
  ],
  exports: [
    AUTH_CONFIG_TOKEN,
    BETTER_AUTH_TOKEN,
    AuthSessionService,
    AuthGuard,
  ],
})
export class AuthModule {}
