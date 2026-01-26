import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import {
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
} from './config/rate-limit.constant';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { CatalogModule } from './catalog/catalog.module';
import { RankingModule } from './ranking/ranking.module';
import { GithubModule } from './github/github.module';
import { DungeonModule } from './dungeon/dungeon.module';
import { DungeonBatchModule } from './dungeon/batch/dungeon-batch.module';
import { LogsModule } from './logs/logs.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { LevelUpModule } from './level-up/level-up.module';
import { ChestModule } from './chest/chest.module';

const isTestEnv = (process.env.NODE_ENV ?? '').toLowerCase() === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pretty = config.get<boolean>('logger.pretty');
        const level = config.get<string>('logger.level', 'info');

        return {
          pinoHttp: {
            level,
            autoLogging: true,
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                  },
                }
              : undefined,
          },
        };
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: DEFAULT_THROTTLE_TTL_MS,
          limit: DEFAULT_THROTTLE_LIMIT,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    SettingsModule,
    DashboardModule,
    InventoryModule,
    CatalogModule,
    RankingModule,
    GithubModule,
    DungeonModule,
    LogsModule,
    EmbeddingModule,
    // 테스트에서는 크론/큐/LevelUp 초기화를 생략해 부트스트랩을 가볍게 유지하고 타임아웃 방지
    // (LevelUpModule은 E2E 테스트에서 typia/mock 충돌로 타임아웃 유발)
    ...(isTestEnv ? [] : [DungeonBatchModule, LevelUpModule, ChestModule]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
