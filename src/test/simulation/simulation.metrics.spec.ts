import { describe, expect, it } from 'vitest';
import { loadEventConfig } from '../../dungeon/events/config/event-config.loader';
import { WeightedDungeonEventSelector } from '../../dungeon/events/event-selector';
import { DungeonEventType } from '../../dungeon/events/event.types';
import { SeedrandomFactory } from '../../dungeon/events/seeded-rng.provider';
import type { DungeonState } from '@prisma/client';
import { BattleEventProcessor } from '../../dungeon/events/processors/battle-event.processor';
import { MonsterRegistry } from '../../dungeon/monsters';
import type { CatalogMonster } from '../../catalog';
import { DropService } from '../../dungeon/drops/drop.service';
import { DropTableRegistry } from '../../dungeon/drops/drop-table';

const createBaseState = (overrides: Partial<DungeonState> = {}): DungeonState =>
  ({
    userId: '00000000-0000-4000-8000-000000000999',
    level: 1,
    exp: 0,
    hp: 10,
    maxHp: 10,
    atk: 1,
    def: 1,
    luck: 0,
    levelUpPoints: 0,
    levelUpRollIndex: 0,
    unopenedChests: 0,
    chestRollIndex: 0,
    equipmentBonus: null,
    statsVersion: 0,
    floor: 1,
    maxFloor: 1,
    floorProgress: 0,
    gold: 0,
    ap: 10,
    currentAction: 'IDLE',
    currentActionStartedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    version: 1,
    ...overrides,
  }) satisfies DungeonState;

describe('simulation metrics', () => {
  it('event weights are reflected in selection ratios', () => {
    const eventConfig = loadEventConfig();
    const selector = new WeightedDungeonEventSelector();
    const rngFactory = new SeedrandomFactory();
    const sampleSize = 10000;
    const tolerance = 0.03;

    const counts: Record<DungeonEventType, number> = {
      BATTLE: 0,
      TREASURE: 0,
      REST: 0,
      TRAP: 0,
      EMPTY: 0,
      MOVE: 0,
    };

    const baseState = createBaseState();

    for (let i = 0; i < sampleSize; i += 1) {
      const rng = rngFactory.create(`event-metrics:${i}`);
      const rngValue = rng.next();
      const selected = selector.select({
        state: baseState,
        rngValue,
        weights: eventConfig.weights,
      });
      counts[selected] += 1;
    }

    const totalWeight = Object.values(eventConfig.weights).reduce(
      (sum, value) => sum + value,
      0,
    );

    (
      Object.keys(eventConfig.weights) as Array<
        keyof typeof eventConfig.weights
      >
    ).forEach((event) => {
      const expected = eventConfig.weights[event] / totalWeight;
      const actual = counts[event] / sampleSize;
      expect(
        actual,
        `${event} ratio ${actual.toFixed(4)} not within ${tolerance} of ${expected.toFixed(4)}`,
      ).toBeGreaterThanOrEqual(expected - tolerance);
      expect(actual).toBeLessThanOrEqual(expected + tolerance);
    });

    expect(counts.MOVE).toBe(0);
  });

  it('drop rate matches configured chance (normal vs elite)', () => {
    const eventConfig = loadEventConfig();
    const rngFactory = new SeedrandomFactory();
    const dropService = new DropService(DropTableRegistry.fromFile());
    const sampleSize = 2000;
    const tolerance = 0.05;

    const strongState = createBaseState({
      hp: 200,
      maxHp: 200,
      atk: 999,
      def: 999,
      luck: 0,
      floor: 1,
    });

    const normalMonster: CatalogMonster = {
      code: 'monster-test-normal',
      nameKey: 'monster.test.normal',
      name: 'Test Normal',
      hp: 1,
      atk: 0,
      def: 0,
      spriteId: 'sprite/monster-test-normal',
      dropTableId: 'drops-default',
      rarity: 'normal',
    };

    const eliteMonster: CatalogMonster = {
      code: 'monster-test-elite',
      nameKey: 'monster.test.elite',
      name: 'Test Elite',
      hp: 1,
      atk: 0,
      def: 0,
      spriteId: 'sprite/monster-test-elite',
      dropTableId: 'drops-default',
      rarity: 'elite',
    };

    const normalProcessor = new BattleEventProcessor(
      MonsterRegistry.from([normalMonster]),
      {
        eliteRate: 0,
        dropChance: eventConfig.battle.dropChance,
        eliteDropMultiplier: eventConfig.battle.eliteDropMultiplier,
        dropService,
        turnLimit: 1,
      },
    );

    const eliteProcessor = new BattleEventProcessor(
      MonsterRegistry.from([eliteMonster]),
      {
        eliteRate: 1,
        dropChance: eventConfig.battle.dropChance,
        eliteDropMultiplier: eventConfig.battle.eliteDropMultiplier,
        dropService,
        turnLimit: 1,
      },
    );

    const countDrops = (processor: BattleEventProcessor, seed: string) => {
      let drops = 0;
      for (let i = 0; i < sampleSize; i += 1) {
        const rngValue = rngFactory.create(`${seed}:${i}`).next();
        const result = processor.process({
          state: strongState,
          rngValue,
        });
        const outcome = (result.extra as { details?: { result?: string } })
          ?.details?.result;
        expect(outcome).toBe('VICTORY');
        if ((result.drops?.length ?? 0) > 0) {
          drops += 1;
        }
      }
      return drops / sampleSize;
    };

    const normalRate = countDrops(normalProcessor, 'drop-normal');
    const eliteRate = countDrops(eliteProcessor, 'drop-elite');

    const expectedNormal = eventConfig.battle.dropChance;
    const expectedElite = Math.min(
      1,
      eventConfig.battle.dropChance * eventConfig.battle.eliteDropMultiplier,
    );

    expect(normalRate).toBeGreaterThanOrEqual(expectedNormal - tolerance);
    expect(normalRate).toBeLessThanOrEqual(expectedNormal + tolerance);
    expect(eliteRate).toBeGreaterThanOrEqual(expectedElite - tolerance);
    expect(eliteRate).toBeLessThanOrEqual(expectedElite + tolerance);
  });
});
