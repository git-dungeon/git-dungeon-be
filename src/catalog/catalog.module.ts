import { Module } from '@nestjs/common';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { CatalogController } from './catalog.controller';

@Module({
  controllers: [CatalogController],
  providers: [
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'CATALOG_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class CatalogModule {}
