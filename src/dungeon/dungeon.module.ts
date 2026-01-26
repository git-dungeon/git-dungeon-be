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
import { EmptyEventProcessor } from './events/processors/empty-event.processor';
import { DungeonLogBuilder } from './events/dungeon-log.builder';
import { loadEventConfig } from './events/config/event-config.loader';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MonsterRegistry } from './monsters';
import type { CatalogMonster } from '../catalog';
import { DropService } from './drops/drop.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  providers: [
    DungeonEventService,
    DungeonLogBuilder,
    {
      provide: MonsterRegistry,
      useFactory: () => {
        const baseDir = join(__dirname, '..', '..');
        const raw = readFileSync(
          join(baseDir, 'config/catalog/monsters.json'),
          'utf8',
        );
        const parsed = JSON.parse(raw) as { monsters: CatalogMonster[] };
        return MonsterRegistry.from(parsed.monsters);
      },
    },
    {
      provide: DungeonEventProcessors,
      useFactory: (
        monsterRegistry: MonsterRegistry,
        dropService: DropService,
      ) => {
        const config = loadEventConfig();
        const effects = config.effects ?? {};
        const battleConfig = config.battle;

        const battle = new BattleEventProcessor(monsterRegistry, {
          eliteRate: battleConfig.eliteRate,
          dropChance: battleConfig.dropChance,
          eliteDropMultiplier: battleConfig.eliteDropMultiplier,
          critBase: battleConfig.critBase,
          critLuckFactor: battleConfig.critLuckFactor,
          turnLimit: battleConfig.turnLimit,
          eliteExpBonus: battleConfig.exp.eliteBonus,
          gold: battleConfig.gold,
          dropService,
        });
        const rest = new RestEventProcessor(effects.REST);
        const treasure = new TreasureEventProcessor(
          effects.TREASURE,
          undefined,
          dropService,
        );
        const trap = new TrapEventProcessor(effects.TRAP);
        const move = new MoveEventProcessor();
        const empty = new EmptyEventProcessor();

        return {
          [DungeonEventType.BATTLE]: battle,
          [DungeonEventType.REST]: rest,
          [DungeonEventType.TREASURE]: treasure,
          [DungeonEventType.TRAP]: trap,
          [DungeonEventType.EMPTY]: empty,
          [DungeonEventType.MOVE]: move,
        };
      },
      inject: [MonsterRegistry, DropService],
    },
    {
      provide: SEEDED_RNG_FACTORY,
      useClass: SeedrandomFactory,
    },
  ],
  exports: [DungeonEventService],
})
export class DungeonModule {}
