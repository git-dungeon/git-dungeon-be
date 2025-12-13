import fs from 'fs';
import path from 'path';
import { DungeonEventService } from '../../dungeon/events/dungeon-event.service';
import { DungeonLogBuilder } from '../../dungeon/events/dungeon-log.builder';
import { SeedrandomFactory } from '../../dungeon/events/seeded-rng.provider';
import { BattleEventProcessor } from '../../dungeon/events/processors/battle-event.processor';
import { RestEventProcessor } from '../../dungeon/events/processors/rest-event.processor';
import { TrapEventProcessor } from '../../dungeon/events/processors/trap-event.processor';
import { TreasureEventProcessor } from '../../dungeon/events/processors/treasure-event.processor';
import { MoveEventProcessor } from '../../dungeon/events/processors/move-event.processor';
import { MonsterRegistry } from '../../dungeon/monsters';
import { DropService } from '../../dungeon/drops/drop.service';
import { DungeonEventType } from '../../dungeon/events/event.types';
import { DropTableRegistry } from '../../dungeon/drops/drop-table';
import { loadEventConfig } from '../../dungeon/events/config/event-config.loader';
import type { CatalogMonster } from '../../catalog/catalog.schema';
import type { DungeonEventProcessor } from '../../dungeon/events/event.types';
import type { DungeonState } from '@prisma/client';
import {
  baselineSnapshot,
  trapDeathSnapshot,
  forcedMoveSnapshot,
  noDropSnapshot,
  longBattleSnapshot,
  turnLimitSnapshot,
} from './fixtures';

// Optional override for battle turnLimit when reproducing turn-limit snapshot
const TEST_TURN_LIMIT = Number(process.env.SIM_TEST_TURN_LIMIT ?? '30');

const eventConfig = loadEventConfig();
type MonstersFile = { monsters: CatalogMonster[] };
const monstersFile = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../config/catalog/monsters.json'),
    'utf-8',
  ),
) as MonstersFile;
const registry = MonsterRegistry.from(monstersFile.monsters);
const dropRegistry = DropTableRegistry.fromFile();
const dropService = new DropService(dropRegistry);
const rngFactory = new SeedrandomFactory();

const processors: Record<DungeonEventType, DungeonEventProcessor> = {
  [DungeonEventType.BATTLE]: new BattleEventProcessor(registry, {
    eliteRate: eventConfig.battle.eliteRate,
    critBase: eventConfig.battle.critBase,
    critLuckFactor: eventConfig.battle.critLuckFactor,
    turnLimit: TEST_TURN_LIMIT,
    eliteExpBonus: eventConfig.battle.exp.eliteBonus,
    dropService,
  }),
  [DungeonEventType.TREASURE]: new TreasureEventProcessor(
    eventConfig.effects.TREASURE,
    rngFactory,
    dropService,
  ),
  [DungeonEventType.REST]: new RestEventProcessor(eventConfig.effects.REST),
  [DungeonEventType.TRAP]: new TrapEventProcessor(eventConfig.effects.TRAP),
  [DungeonEventType.MOVE]: new MoveEventProcessor(),
};

const service = new DungeonEventService(
  rngFactory,
  processors,
  new DungeonLogBuilder(),
);

type OutputStep = {
  actionCounter: number;
  selectedEvent: DungeonEventType;
  stateAfter: {
    hp: number;
    ap: number;
    floor: number;
    floorProgress: number;
    level: number;
    exp: number;
    version: number;
  };
  logs: Array<{
    action: string;
    status: string;
    delta: unknown;
    extra: unknown;
  }>;
};

type Snapshot = {
  seed: string;
  initialState: DungeonState;
  results: Array<{ actionCounter: number }>;
};

async function runSnapshot(snapshot: Snapshot): Promise<OutputStep[]> {
  let state: DungeonState = { ...snapshot.initialState };
  const outputs: OutputStep[] = [];
  for (const step of snapshot.results) {
    const res = await service.execute({
      state,
      seed: snapshot.seed,
      actionCounter: step.actionCounter,
      apCost: 1,
    });
    outputs.push({
      actionCounter: step.actionCounter,
      selectedEvent: res.selectedEvent,
      stateAfter: {
        hp: res.stateAfter.hp,
        ap: res.stateAfter.ap,
        floor: res.stateAfter.floor,
        floorProgress: res.stateAfter.floorProgress,
        level: res.stateAfter.level,
        exp: res.stateAfter.exp,
        version: res.stateAfter.version,
      },
      logs: res.logs.map((l) => ({
        action: l.action,
        status: l.status,
        delta: l.delta,
        extra: l.extra,
      })),
    });
    state = res.stateAfter;
  }
  return outputs;
}

async function main() {
  const snapshots = [
    baselineSnapshot,
    trapDeathSnapshot,
    forcedMoveSnapshot,
    noDropSnapshot,
    longBattleSnapshot,
    turnLimitSnapshot,
  ];
  for (const snap of snapshots) {
    const res = await runSnapshot(snap);
    console.log(`\n=== ${snap.seed} ===`);
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
