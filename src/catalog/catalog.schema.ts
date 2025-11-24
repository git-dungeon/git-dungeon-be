import typia, { tags, type IValidation } from 'typia';
import type { InventoryModifier } from '../common/inventory/inventory-modifier';
import type { InventorySlot } from '../inventory/dto/inventory.response';

export const CATALOG_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;
export type CatalogRarity = (typeof CATALOG_RARITIES)[number];

export interface CatalogItem {
  code: string & tags.MinLength<1>;
  nameKey: string & tags.MinLength<1>;
  descriptionKey?: string | null;
  name: string;
  slot: InventorySlot;
  rarity: CatalogRarity;
  modifiers: InventoryModifier[];
  effectCode?: string | null;
  spriteId: string;
  description?: string | null;
}

export interface CatalogBuff {
  buffId: string & tags.MinLength<1>;
  nameKey: string & tags.MinLength<1>;
  descriptionKey?: string | null;
  name: string;
  effectCode: string;
  durationTurns?: number | null;
  maxStacks?: number | null;
  spriteId?: string | null;
  description?: string | null;
}

export interface CatalogMonster {
  id: string & tags.MinLength<1>;
  nameKey: string & tags.MinLength<1>;
  descriptionKey?: string | null;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spriteId: string;
  dropTableId?: string | null;
  description?: string | null;
}

export interface CatalogDrop {
  itemCode: string;
  weight: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface CatalogDropTable {
  tableId: string & tags.MinLength<1>;
  drops: CatalogDrop[];
}

export interface CatalogData {
  version: number & tags.Minimum<0>;
  updatedAt: string & tags.Format<'date-time'>;
  items: CatalogItem[];
  buffs: CatalogBuff[];
  monsters: CatalogMonster[];
  dropTables: CatalogDropTable[];
  assetsBaseUrl?: string | null;
  spriteMap?: Record<string, string> | null;
}

export const assertCatalogData: (input: unknown) => CatalogData = (input) =>
  typia.assert<CatalogData>(input);
export const validateCatalogData: (
  input: unknown,
) => IValidation<CatalogData> = (input) => typia.validate<CatalogData>(input);
