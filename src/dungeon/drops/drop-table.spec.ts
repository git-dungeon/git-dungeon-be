import { describe, expect, it } from 'vitest';
import type { DropEntry, DropTable } from './drop-table';
import { DropTableRegistry, rollTable } from './drop-table';

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

describe('DropTableRegistry', () => {
  it('기본 드랍 테이블 구성을 로드한다', () => {
    const registry = DropTableRegistry.fromFile();
    const table = registry.get('drops-floor-1');

    expect(table.tableId).toBe('drops-floor-1');
    expect(table.drops.length).toBeGreaterThan(0);
  });
});

describe('rollTable', () => {
  const table: DropTable = {
    tableId: 'test',
    drops: [
      makeEntry('common-sword', 1, 1, 1),
      makeEntry('rare-helm', 3, 1, 2),
      makeEntry('epic-ring', 6, 2, 3),
    ],
  };

  it('가중치에 따라 결정적 선택을 수행한다', () => {
    const rng = fixedRng([
      0.0, // pick first (common-sword)
      0.4, // quantity roll for first (1)
      0.2, // pick rare-helm
      0.7, // quantity roll for rare-helm (2)
      0.95, // pick epic-ring
      0.1, // quantity roll for epic-ring (2)
    ]);

    const results = rollTable(table, rng, { rolls: 3 });

    expect(results).toEqual([
      { itemCode: 'common-sword', quantity: 1 },
      { itemCode: 'rare-helm', quantity: 2 },
      { itemCode: 'epic-ring', quantity: 2 },
    ]);
  });

  it('빈 테이블이면 결과를 반환하지 않는다', () => {
    const emptyTable: DropTable = { tableId: 'empty', drops: [] };
    const rng = fixedRng([0.5]);

    const results = rollTable(emptyTable, rng);
    expect(results).toEqual([]);
  });
});

function makeEntry(
  itemCode: string,
  weight: number,
  minQuantity: number,
  maxQuantity: number,
): DropEntry {
  return { itemCode, weight, minQuantity, maxQuantity };
}
