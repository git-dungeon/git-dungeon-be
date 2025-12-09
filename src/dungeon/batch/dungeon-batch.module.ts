import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DungeonModule } from '../dungeon.module';
import { DungeonBatchService } from './dungeon-batch.service';
import { DungeonBatchLockService } from './dungeon-batch.lock.service';

@Module({
  imports: [ConfigModule, ScheduleModule, DungeonModule],
  providers: [DungeonBatchService, DungeonBatchLockService],
})
export class DungeonBatchModule {}
