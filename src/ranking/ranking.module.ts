import { Module } from '@nestjs/common';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

@Module({
  imports: [PrismaModule],
  controllers: [RankingController],
  providers: [
    RankingService,
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'RANKING_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class RankingModule {}
