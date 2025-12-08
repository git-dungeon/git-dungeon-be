import { describe, expect, it } from 'vitest';
import seedrandom from 'seedrandom';
import { DropEngine, mergeResults } from './drop-engine';
import type { DropTable } from './drop-table';
import { DropTableRegistry, rollTable } from './drop-table';
import { getCatalogItemMeta } from './drop.utils';

const fixedRng = (values: number[]) => {
  let index = 0;
  return {
    next: () => {
      const value = values[index] ?? values.at(-1) ?? 0;
      index += 1;
      return value;
    },
  };
};

const baseTable: DropTable = {
  tableId: 'test',
  drops: [
    { itemCode: 'common', weight: 1, minQuantity: 1, maxQuantity: 1 },
    { itemCode: 'rare', weight: 3, minQuantity: 1, maxQuantity: 2 },
  ],
};

describe('mergeResults', () => {
  it('동일 itemCode를 수량 합산하여 병합한다', () => {
    const merged = mergeResults([
      { itemCode: 'common', quantity: 1 },
      { itemCode: 'common', quantity: 2 },
      { itemCode: 'rare', quantity: 1 },
    ]);

    expect(merged).toEqual([
      { itemCode: 'common', quantity: 3 },
      { itemCode: 'rare', quantity: 1 },
    ]);
  });
});

describe('DropEngine', () => {
  it('기본 1회 롤에서 가중치에 따라 항목을 선택한다', () => {
    const rng = fixedRng([0.9, 0.2]); // pick rare, then quantity 1
    const engine = new DropEngine({ eliteExtraRolls: 1 });

    const results = engine.roll({
      table: baseTable,
      rng,
      isElite: false,
    });

    expect(results).toEqual([{ itemCode: 'rare', quantity: 1 }]);
  });

  it('엘리트일 때 추가 롤이 적용되고 결과가 병합된다', () => {
    // first roll -> rare(2), second roll -> common(1)
    const rng = fixedRng([
      0.6, // pick rare
      0.8, // quantity 2
      0.1, // pick common
      0.0, // quantity 1
    ]);
    const engine = new DropEngine({ eliteExtraRolls: 1 });

    const results = engine.roll({
      table: baseTable,
      rng,
      isElite: true,
    });

    expect(results).toEqual([
      { itemCode: 'rare', quantity: 2 },
      { itemCode: 'common', quantity: 1 },
    ]);
  });

  it('tableId가 Angel Ring 단일 엔트리일 때 항상 해당 아이템만 반환한다', () => {
    const dragonTable: DropTable = {
      tableId: 'drops-ancient-dragon',
      drops: [
        { itemCode: 'angel-ring', weight: 100, minQuantity: 1, maxQuantity: 1 },
      ],
    };
    const rng = fixedRng([0.3]); // any value
    const engine = new DropEngine();

    const results = engine.roll({ table: dragonTable, rng });

    expect(results).toEqual([{ itemCode: 'angel-ring', quantity: 1 }]);
  });

  it('동일 시드에서 결정적으로 동일 결과를 반환한다', () => {
    const engine = new DropEngine({ eliteExtraRolls: 1 });
    const run = () => {
      const rng = seedrandom('drop-deterministic');
      return engine.roll({
        table: baseTable,
        rng: { next: () => rng.quick() },
        isElite: true,
      });
    };

    const first = run();
    const second = run();
    expect(first).toEqual(second);
  });
});

describe('rollTable', () => {
  it('가중치 합이 0 이하이면 오류를 발생시킨다', () => {
    const zeroTable: DropTable = {
      tableId: 'zero',
      drops: [{ itemCode: 'none', weight: 0, minQuantity: 1, maxQuantity: 1 }],
    };
    const rng = fixedRng([0]);

    expect(() => rollTable(zeroTable, rng)).toThrow(/가중치 합이 0 이하/);
  });

  it('빈 테이블이면 결과를 반환하지 않는다', () => {
    const emptyTable: DropTable = { tableId: 'empty', drops: [] };
    const rng = fixedRng([0.5]);

    const results = rollTable(emptyTable, rng);
    expect(results).toEqual([]);
  });

  it('가중치 분포가 기대 비율에 근접한다', () => {
    const rngSeed = seedrandom('drop-distribution');
    const rng = { next: () => rngSeed.quick() };
    let commonCount = 0;
    let rareCount = 0;
    const samples = 20000;

    for (let i = 0; i < samples; i += 1) {
      const [pick] = rollTable(baseTable, rng);
      if (pick?.itemCode === 'common') commonCount += 1;
      if (pick?.itemCode === 'rare') rareCount += 1;
    }

    const commonRatio = commonCount / samples;
    const rareRatio = rareCount / samples;

    // 기대 비율: common 0.25, rare 0.75. 허용 오차 ±5%.
    expect(commonRatio).toBeGreaterThan(0.2);
    expect(commonRatio).toBeLessThan(0.3);
    expect(rareRatio).toBeGreaterThan(0.7);
    expect(rareRatio).toBeLessThan(0.8);
  });

  it('기본 드랍 테이블이 슬롯 가중치에 따라 선택된다', () => {
    const table = DropTableRegistry.fromFile().get('drops-default');
    const weightBySlot = new Map<string, number>();
    let totalWeight = 0;
    table.drops.forEach((drop) => {
      const slot = (
        getCatalogItemMeta(drop.itemCode)?.slot ?? 'unknown'
      ).toLowerCase();
      weightBySlot.set(slot, (weightBySlot.get(slot) ?? 0) + drop.weight);
      totalWeight += drop.weight;
    });

    const expectedRatioBySlot = new Map(
      Array.from(weightBySlot.entries()).map(([slot, weight]) => [
        slot,
        weight / totalWeight,
      ]),
    );

    const rngSeed = seedrandom('drop-default-slot');
    const rng = { next: () => rngSeed.quick() };
    const counts = new Map<string, number>();
    const samples = 15000;

    for (let i = 0; i < samples; i += 1) {
      const [pick] = rollTable(table, rng);
      if (!pick) continue;
      const slot = (
        getCatalogItemMeta(pick.itemCode)?.slot ?? 'unknown'
      ).toLowerCase();
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }

    expectedRatioBySlot.forEach((expected, slot) => {
      const actual = (counts.get(slot) ?? 0) / samples;
      expect(Math.abs(actual - expected)).toBeLessThan(0.05);
    });
  });
});
