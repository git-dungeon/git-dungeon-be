import { describe, expect, it } from 'vitest';
import { DropEngine, mergeResults } from './drop-engine';
import type { DropTable } from './drop-table';
import { rollTable } from './drop-table';

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
});
