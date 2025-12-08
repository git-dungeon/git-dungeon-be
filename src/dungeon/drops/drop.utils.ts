import type { InventoryDelta } from '../../common/logs/dungeon-log-delta';
import type { DropResult } from './drop-table';
import type { DropService } from './drop.service';
import { DEFAULT_DROP_TABLE_ID } from './drop.service';

export type RollDropsParams = {
  dropService?: DropService;
  tableId?: string | null;
  rng: { next: () => number };
  isElite?: boolean;
  rolls?: number;
};

export const rollDrops = (params: RollDropsParams): DropResult[] => {
  if (!params.dropService) return [];
  return params.dropService.roll({
    tableId: params.tableId ?? DEFAULT_DROP_TABLE_ID,
    rng: params.rng,
    isElite: params.isElite,
    rolls: params.rolls,
  });
};

export const mapDropsToInventoryAdds = (
  drops: DropResult[] | undefined,
): InventoryDelta['added'] => {
  if (!Array.isArray(drops)) return [];
  return drops.map((drop) => ({
    itemId: drop.itemCode,
    code: drop.itemCode,
    slot: 'unknown',
    rarity: undefined,
    quantity: drop.quantity,
  }));
};
