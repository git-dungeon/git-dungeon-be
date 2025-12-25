import fs from 'node:fs';
import path from 'node:path';
import type { InventoryDelta } from '../../common/logs/dungeon-log-delta';
import type { DropResult } from './drop-table';
import type { DropService } from './drop.service';
import { DEFAULT_DROP_TABLE_ID } from './drop.service';
import { deterministicUuidV5 } from '../../common/ids/deterministic-uuid';

type ItemSlot = string;

type CatalogItemMeta = {
  code: string;
  slot: ItemSlot;
  rarity?: string | null;
  modifiers?: unknown;
};

let cachedCatalogItems: Map<string, CatalogItemMeta> | null = null;

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
  const catalog = loadCatalogItemMap();
  return drops.map((drop) => ({
    itemId: deterministicUuidV5(`inventory:${drop.code}`),
    code: drop.code,
    slot: catalog.get(drop.code)?.slot ?? 'unknown',
    rarity: catalog.get(drop.code)?.rarity ?? undefined,
    quantity: drop.quantity,
  }));
};

export const getCatalogItemMeta = (code: string): CatalogItemMeta | undefined =>
  loadCatalogItemMap().get(code);

const loadCatalogItemMap = (): Map<string, CatalogItemMeta> => {
  if (cachedCatalogItems) return cachedCatalogItems;
  const catalogPath = path.resolve(process.cwd(), 'config/catalog/items.json');
  try {
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const parsed = JSON.parse(raw) as { items?: CatalogItemMeta[] };
    const map = new Map<string, CatalogItemMeta>();
    (parsed.items ?? []).forEach((item) => {
      if (!item?.code) return;
      map.set(item.code, {
        code: item.code,
        slot: item.slot,
        rarity: item.rarity,
        modifiers: item.modifiers,
      });
    });
    cachedCatalogItems = map;
    return map;
  } catch (_error) {
    // 실패 시 빈 맵으로 fallback
    cachedCatalogItems = new Map();
    return cachedCatalogItems;
  }
};
