import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CollectionController],
  providers: [
    CollectionService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'COLLECTION_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
  exports: [CollectionService],
})
export class CollectionModule {}
