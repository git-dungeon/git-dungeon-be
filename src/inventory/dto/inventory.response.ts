import type { InventoryModifier } from '../../common/inventory/inventory-modifier';

export type InventorySlot =
  | 'helmet'
  | 'armor'
  | 'weapon'
  | 'ring'
  | 'consumable'
  | 'material';

export type EquippableSlot = 'helmet' | 'armor' | 'weapon' | 'ring';

export type InventoryRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

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
