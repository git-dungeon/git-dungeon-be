import type { InventoryModifier } from '../../common/inventory/inventory-modifier';

export const INVENTORY_SLOTS = [
  'helmet',
  'armor',
  'weapon',
  'ring',
  'consumable',
  'material',
] as const;
export type InventorySlot = (typeof INVENTORY_SLOTS)[number];

export const EQUIPPABLE_SLOTS = ['helmet', 'armor', 'weapon', 'ring'] as const;
export type EquippableSlot = (typeof EQUIPPABLE_SLOTS)[number];

export const INVENTORY_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;
export type InventoryRarity = (typeof INVENTORY_RARITIES)[number];

export interface EquipmentItem {
  id: string;
  code: string;
  name?: string | null;
  slot: InventorySlot;
  rarity: InventoryRarity;
  modifiers: InventoryModifier[];
  effect?: string | null;
  sprite?: string | null;
  createdAt: string;
  isEquipped: boolean;
  quantity: number;
  enhancementLevel: number;
  version: number;
}

export interface EquipmentStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
}

export interface EquipmentSummary {
  base: EquipmentStats;
  total: EquipmentStats;
  equipmentBonus: EquipmentStats;
}

export type EquippedItems = Partial<Record<EquippableSlot, EquipmentItem>>;

export interface InventoryResponse {
  version: number;
  items: EquipmentItem[];
  equipped: EquippedItems;
  summary: EquipmentSummary;
}
