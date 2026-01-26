import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChestController } from './chest.controller';
import { ChestService } from './chest.service';
import { DropService } from '../dungeon/drops/drop.service';
import { DropInventoryService } from '../dungeon/drops/drop-inventory.service';
import {
  SEEDED_RNG_FACTORY,
  SeedrandomFactory,
} from '../dungeon/events/seeded-rng.provider';

@Module({
  imports: [PrismaModule],
  controllers: [ChestController],
  providers: [
    ChestService,
    DropService,
    DropInventoryService,
    {
      provide: SEEDED_RNG_FACTORY,
      useClass: SeedrandomFactory,
    },
  ],
})
export class ChestModule {}
