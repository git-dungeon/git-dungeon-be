import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { AuthModule } from '../auth/auth.module';
import { StatsCacheService } from '../common/stats/stats-cache.service';
import { CollectionTrackerService } from '../collection/collection-tracker.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    StatsCacheService,
    CollectionTrackerService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'INVENTORY_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
