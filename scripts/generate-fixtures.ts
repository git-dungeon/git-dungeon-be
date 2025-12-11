import fs from 'fs';
import path from 'path';
import { DungeonEventService } from '../src/dungeon/events/dungeon-event.service';
import { DungeonLogBuilder } from '../src/dungeon/events/dungeon-log.builder';
import { SeedrandomFactory } from '../src/dungeon/events/seeded-rng.provider';
import { BattleEventProcessor } from '../src/dungeon/events/processors/battle-event.processor';
import { RestEventProcessor } from '../src/dungeon/events/processors/rest-event.processor';
import { TrapEventProcessor } from '../src/dungeon/events/processors/trap-event.processor';
import { TreasureEventProcessor } from '../src/dungeon/events/processors/treasure-event.processor';
import { MoveEventProcessor } from '../src/dungeon/events/processors/move-event.processor';
import { MonsterRegistry } from '../src/dungeon/monsters';
import { DropService } from '../src/dungeon/drops/drop.service';
import { DungeonEventType } from '../src/dungeon/events/event.types';
import { DropTableRegistry } from '../src/dungeon/drops/drop-table';
import { loadEventConfig } from '../src/dungeon/events/config/event-config.loader';
import type { DungeonEventProcessor } from '../src/dungeon/events/event.types';
import type { DungeonState } from '@prisma/client';
import type { CatalogMonster } from '../src/catalog/catalog.schema';
import {
  baselineSnapshot,
  trapDeathSnapshot,
  forcedMoveSnapshot,
  noDropSnapshot,
  longBattleSnapshot,
  turnLimitSnapshot,
  eliteBattleSnapshot,
  restClampSnapshot,
  levelUpSnapshot,
} from '../src/test-support/dungeon/fixtures';

const TEST_TURN_LIMIT = Number(process.env.SIM_TEST_TURN_LIMIT ?? '30');

const eventConfig = loadEventConfig();
type MonstersFile = { monsters: CatalogMonster[] };
const monstersFile = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../config/catalog/monsters.json'),
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
  const outDir = path.join(
    __dirname,
    '../docs/db/fixtures/dungeon-simulation/generated',
  );
  fs.mkdirSync(outDir, { recursive: true });
  const snapshots = [
    baselineSnapshot,
    trapDeathSnapshot,
    forcedMoveSnapshot,
    noDropSnapshot,
    longBattleSnapshot,
    turnLimitSnapshot,
    eliteBattleSnapshot,
    restClampSnapshot,
    levelUpSnapshot,
  ];

  for (const snap of snapshots) {
    const outputs = await runSnapshot(snap);
    const file = path.join(outDir, `${snap.seed}.json`);
    fs.writeFileSync(file, JSON.stringify(outputs, null, 2), 'utf-8');
    console.log(`generated ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
