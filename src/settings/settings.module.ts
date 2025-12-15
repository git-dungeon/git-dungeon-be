import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'SETTINGS_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class SettingsModule {}
