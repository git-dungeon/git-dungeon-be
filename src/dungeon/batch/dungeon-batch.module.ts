import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DungeonModule } from '../dungeon.module';
import { DungeonBatchService } from './dungeon-batch.service';
import { DungeonBatchLockService } from './dungeon-batch.lock.service';
import { SimpleQueue } from '../../common/queue/simple-queue';
import { ConfigService } from '@nestjs/config';
import { StatsCacheService } from '../../common/stats/stats-cache.service';

@Module({
  imports: [ConfigModule, ScheduleModule, DungeonModule],
  providers: [
    DungeonBatchService,
    DungeonBatchLockService,
    StatsCacheService,
    {
      provide: 'DUNGEON_BATCH_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SimpleQueue('dungeon-batch', config),
    },
  ],
})
export class DungeonBatchModule {}
