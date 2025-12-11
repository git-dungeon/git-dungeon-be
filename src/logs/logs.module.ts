import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LogsController],
  providers: [
    LogsService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'LOGS_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class LogsModule {}
