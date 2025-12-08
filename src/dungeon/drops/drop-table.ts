import fs from 'node:fs';
import path from 'node:path';
import type { SeededRandom } from '../events/seeded-rng.provider';

export type DropEntry = {
  itemCode: string;
  weight: number;
  minQuantity: number;
  maxQuantity: number;
};

export type DropTable = {
  tableId: string;
  drops: DropEntry[];
};

export type DropResult = {
  itemCode: string;
  quantity: number;
};

type RandomSource = Pick<SeededRandom, 'next'>;

const DEFAULT_DROP_CONFIG_PATH = path.resolve(
  process.cwd(),
  'config/catalog/drops.json',
);

export class DropTableRegistry {
  private readonly tables: Map<string, DropTable>;

  constructor(tables: DropTable[]) {
    this.tables = new Map(tables.map((table) => [table.tableId, table]));
  }

  static fromFile(configPath: string = DEFAULT_DROP_CONFIG_PATH) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<{
      dropTables: DropTable[];
    }>;

    if (!parsed.dropTables || !Array.isArray(parsed.dropTables)) {
      throw new Error('드랍 테이블 구성을 찾을 수 없습니다.');
    }

    const normalized = parsed.dropTables.map(normalizeDropTable);
    return new DropTableRegistry(normalized);
  }

  get(tableId: string): DropTable {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error(`드랍 테이블을 찾을 수 없습니다: ${tableId}`);
    }
    return table;
  }

  list(): DropTable[] {
    return Array.from(this.tables.values());
  }
}

export type DropRollOptions = {
  rolls?: number;
};

export function rollTable(
  table: DropTable,
  rng: RandomSource,
  options: DropRollOptions = {},
): DropResult[] {
  if (!table.drops.length) {
    return [];
  }

  const rolls = options.rolls ?? 1;
  const results: DropResult[] = [];

  for (let i = 0; i < rolls; i += 1) {
    const entry = pickEntry(table.drops, rng);
    const quantity = rollQuantity(entry, rng);
    results.push({ itemCode: entry.itemCode, quantity });
  }

  return results;
}

function pickEntry(drops: DropEntry[], rng: RandomSource): DropEntry {
  const totalWeight = drops.reduce((acc, item) => acc + item.weight, 0);
  if (totalWeight <= 0) {
    throw new Error('가중치 합이 0 이하입니다.');
  }

  const roll = rng.next() * totalWeight;
  let acc = 0;
  for (const entry of drops) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry;
    }
  }

  return drops[drops.length - 1];
}

function rollQuantity(entry: DropEntry, rng: RandomSource): number {
  const min = Math.max(1, entry.minQuantity);
  const max = Math.max(min, entry.maxQuantity);
  const span = max - min + 1;
  return min + Math.floor(rng.next() * span);
}

function normalizeDropTable(table: DropTable): DropTable {
  return {
    tableId: table.tableId,
    drops: (table.drops ?? []).map(normalizeDropEntry),
  };
}

function normalizeDropEntry(entry: DropEntry): DropEntry {
  return {
    itemCode: entry.itemCode,
    weight: Number(entry.weight),
    minQuantity: Number(entry.minQuantity),
    maxQuantity: Number(entry.maxQuantity),
  };
}
