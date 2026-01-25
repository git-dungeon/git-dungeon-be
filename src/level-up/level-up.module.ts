import { Module } from '@nestjs/common';
import {
  AuthenticatedThrottlerGuard,
  RATE_LIMIT_CONFIG,
} from '../common/guards/authenticated-throttler.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LevelUpController } from './level-up.controller';
import { LevelUpService } from './level-up.service';
import {
  SEEDED_RNG_FACTORY,
  SeedrandomFactory,
} from '../dungeon/events/seeded-rng.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LevelUpController],
  providers: [
    LevelUpService,
    {
      provide: SEEDED_RNG_FACTORY,
      useClass: SeedrandomFactory,
    },
    {
      provide: RATE_LIMIT_CONFIG,
      useValue: {
        code: 'LEVEL_UP_RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    AuthenticatedThrottlerGuard,
  ],
})
export class LevelUpModule {}
