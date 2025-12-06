import { Module } from '@nestjs/common';
import { DungeonEventService } from './events/dungeon-event.service';
import {
  SEEDED_RNG_FACTORY,
  SeedrandomFactory,
} from './events/seeded-rng.provider';
import { DungeonEventProcessors } from './events/event.tokens';
import { DungeonEventType } from './events/event.types';
import { BattleEventProcessor } from './events/processors/battle-event.processor';
import { RestEventProcessor } from './events/processors/rest-event.processor';
import { TreasureEventProcessor } from './events/processors/treasure-event.processor';
import { TrapEventProcessor } from './events/processors/trap-event.processor';
import { MoveEventProcessor } from './events/processors/move-event.processor';
import { DungeonLogBuilder } from './events/dungeon-log.builder';
import { loadEventConfig } from './events/config/event-config';

@Module({
  providers: [
    DungeonEventService,
    DungeonLogBuilder,
    {
      provide: DungeonEventProcessors,
      useFactory: () => {
        const config = loadEventConfig();
        const effects = config.effects ?? {};

        const battle = new BattleEventProcessor();
        const rest = new RestEventProcessor(effects.REST);
        const treasure = new TreasureEventProcessor(effects.TREASURE);
        const trap = new TrapEventProcessor(effects.TRAP);
        const move = new MoveEventProcessor();

        return {
          [DungeonEventType.BATTLE]: battle,
          [DungeonEventType.REST]: rest,
          [DungeonEventType.TREASURE]: treasure,
          [DungeonEventType.TRAP]: trap,
          [DungeonEventType.MOVE]: move,
        };
      },
    },
    {
      provide: SEEDED_RNG_FACTORY,
      useClass: SeedrandomFactory,
    },
  ],
  exports: [DungeonEventService],
})
export class DungeonModule {}
