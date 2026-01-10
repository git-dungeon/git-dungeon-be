import { Module } from '@nestjs/common';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { DashboardModule } from '../dashboard/dashboard.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingController } from './embedding.controller';
import { EmbedRendererService } from './embed-renderer.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [PrismaModule, DashboardModule, InventoryModule],
  controllers: [EmbeddingController],
  providers: [
    EmbeddingService,
    EmbedRendererService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'EMBEDDING_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class EmbeddingModule {}
