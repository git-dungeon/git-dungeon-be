import type { InventoryModifier } from '../../common/inventory/inventory-modifier';
import { tags } from 'typia';

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
  id: string &
    tags.Format<'uuid'> &
    tags.Example<'11111111-1111-4111-8111-111111111111'>;
  code: string & tags.Example<'weapon-longsword'>;
  name?: (string & tags.Example<'Longsword'>) | null;
  slot: InventorySlot & tags.Example<'weapon'>;
  rarity: InventoryRarity & tags.Example<'common'>;
  modifiers: InventoryModifier[];
  effect?: (string & tags.Example<'bleed-1'>) | null;
  sprite?: (string & tags.Example<'sprite/weapon-longsword.svg'>) | null;
  createdAt: string & tags.Format<'date-time'>;
  isEquipped: boolean & tags.Example<true>;
  quantity: number & tags.Minimum<1> & tags.Example<2>;
  enhancementLevel: number & tags.Minimum<0> & tags.Example<3>;
  version: number & tags.Minimum<0>;
}

export interface EquipmentStats {
  hp: number & tags.Example<32>;
  maxHp: number & tags.Example<40>;
  atk: number & tags.Example<18>;
  def: number & tags.Example<14>;
  luck: number & tags.Example<6>;
}

export interface EquipmentSummary {
  base: EquipmentStats;
  total: EquipmentStats;
  equipmentBonus: EquipmentStats;
}

export type EquippedItems = Partial<Record<EquippableSlot, EquipmentItem>>;

export interface InventoryResponse {
  version: number & tags.Minimum<0> & tags.Example<7>;
  items: EquipmentItem[];
  equipped: EquippedItems;
  summary: EquipmentSummary;
}
