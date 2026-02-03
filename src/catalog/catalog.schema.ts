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

export const CATALOG_MONSTER_RARITIES = ['normal', 'elite'] as const;
export type CatalogMonsterRarity = (typeof CATALOG_MONSTER_RARITIES)[number];

export const ENHANCEMENT_SLOTS = ['helmet', 'armor', 'weapon', 'ring'] as const;
export type EnhancementSlot = (typeof ENHANCEMENT_SLOTS)[number];

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
  code: string & tags.MinLength<1>;
  nameKey: string & tags.MinLength<1>;
  descriptionKey?: string | null;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spriteId: string;
  dropTableId?: string | null;
  description?: string | null;
  rarity: CatalogMonsterRarity;
  variantOf?: string | null;
}

export interface CatalogDrop {
  code: string;
  weight: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface CatalogDropTable {
  tableId: string & tags.MinLength<1>;
  drops: CatalogDrop[];
}

export interface CatalogEnhancementConfig {
  maxLevel: number & tags.Minimum<1>;
  successRates: Record<string, number>;
  goldCosts: Record<string, number>;
  materialCounts: Record<string, number>;
  materialsBySlot: Record<EnhancementSlot, string>;
}

export interface CatalogDismantleConfig {
  baseMaterialQuantityByRarity: Record<CatalogRarity, number>;
  refundByEnhancementLevel: Record<string, number>;
}

export interface CatalogData {
  version: number & tags.Minimum<0>;
  updatedAt: string & tags.Format<'date-time'>;
  items: CatalogItem[];
  buffs: CatalogBuff[];
  monsters: CatalogMonster[];
  dropTables: CatalogDropTable[];
  enhancement: CatalogEnhancementConfig;
  dismantle: CatalogDismantleConfig;
  assetsBaseUrl?: string | null;
  spriteMap?: Record<string, string> | null;
}

export const assertCatalogData: (input: unknown) => CatalogData = (input) =>
  typia.assert<CatalogData>(input);
export const validateCatalogData: (
  input: unknown,
) => IValidation<CatalogData> = (input) => typia.validate<CatalogData>(input);
