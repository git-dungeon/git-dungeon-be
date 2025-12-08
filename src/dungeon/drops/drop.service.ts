import type { SeededRandom } from '../events/seeded-rng.provider';
import { DropEngine } from './drop-engine';
import type { DropResult } from './drop-table';
import { DropTableRegistry } from './drop-table';

export type DropServiceOptions = {
  defaultTableId?: string;
};

const DEFAULT_TABLE_ID = 'drops-default';

export class DropService {
  constructor(
    private readonly registry = DropTableRegistry.fromFile(),
    private readonly engine = new DropEngine(),
    private readonly options: DropServiceOptions = {},
  ) {}

  roll(params: {
    tableId?: string | null;
    rng: Pick<SeededRandom, 'next'>;
    isElite?: boolean;
    rolls?: number;
  }): DropResult[] {
    const tableId =
      params.tableId ?? this.options.defaultTableId ?? DEFAULT_TABLE_ID;
    const table = this.registry.get(tableId);
    return this.engine.roll({
      table,
      rng: params.rng,
      isElite: params.isElite,
      rolls: params.rolls,
    });
  }
}

export const DEFAULT_DROP_TABLE_ID = DEFAULT_TABLE_ID;
