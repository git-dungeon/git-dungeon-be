import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChestController } from './chest.controller';
import { ChestService } from './chest.service';
import {
  SEEDED_RNG_FACTORY,
  SeedrandomFactory,
} from '../dungeon/events/seeded-rng.provider';
import { SharedModule } from '../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';

@Module({
  imports: [PrismaModule, SharedModule, AuthModule],
  controllers: [ChestController],
  providers: [
    ChestService,
    {
      provide: SEEDED_RNG_FACTORY,
      useClass: SeedrandomFactory,
    },
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'CHEST_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
  exports: [ChestService],
})
export class ChestModule {}
