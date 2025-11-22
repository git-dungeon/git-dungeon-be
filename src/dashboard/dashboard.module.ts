import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'DASHBOARD_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
