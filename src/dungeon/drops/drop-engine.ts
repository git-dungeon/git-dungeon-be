import type { SeededRandom } from '../events/seeded-rng.provider';
import type { DropResult, DropTable } from './drop-table';
import { rollTable } from './drop-table';

export type DropEngineOptions = {
  eliteExtraRolls?: number;
  baseRolls?: number;
};

export type DropContext = {
  table: DropTable;
  rng: Pick<SeededRandom, 'next'>;
  isElite?: boolean;
  rolls?: number;
};

const DEFAULT_OPTIONS: Required<DropEngineOptions> = {
  eliteExtraRolls: 1,
  baseRolls: 1,
};

export const mergeResults = (results: DropResult[]): DropResult[] => {
  const merged = new Map<string, number>();
  results.forEach((result) => {
    const current = merged.get(result.itemCode) ?? 0;
    merged.set(result.itemCode, current + result.quantity);
  });
  return Array.from(merged.entries()).map(([itemCode, quantity]) => ({
    itemCode,
    quantity,
  }));
};

export class DropEngine {
  constructor(private readonly options: DropEngineOptions = {}) {}

  roll(context: DropContext): DropResult[] {
    const opts = { ...DEFAULT_OPTIONS, ...this.options };
    const rolls =
      (context.rolls ?? opts.baseRolls) +
      (context.isElite ? opts.eliteExtraRolls : 0);

    const results: DropResult[] = [];
    for (let i = 0; i < rolls; i += 1) {
      const rolled = rollTable(context.table, context.rng);
      results.push(...rolled);
    }

    return mergeResults(results);
  }
}
