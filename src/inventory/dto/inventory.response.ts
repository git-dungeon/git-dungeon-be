import type { InventoryModifier } from '../../common/inventory/inventory-modifier';
import { tags } from 'typia';

export type InventorySlot =
  | 'helmet'
  | 'armor'
  | 'weapon'
  | 'ring'
  | 'consumable';

export interface EquipmentItem {
  id: string & tags.Example<'weapon-longsword'>;
  code: string & tags.Example<'weapon-longsword'>;
  name?: (string & tags.Example<'Longsword'>) | null;
  slot: InventorySlot & tags.Example<'weapon'>;
  rarity:
    | (string & tags.Example<'common'>)
    | (string & tags.Example<'uncommon'>)
    | (string & tags.Example<'rare'>)
    | (string & tags.Example<'epic'>)
    | (string & tags.Example<'legendary'>);
  modifiers: InventoryModifier[];
  effect?: (string & tags.Example<'bleed-1'>) | null;
  sprite?: (string & tags.Example<'sprite/weapon-longsword.svg'>) | null;
  createdAt: string & tags.Format<'date-time'>;
  isEquipped: boolean & tags.Example<true>;
  version: number & tags.Minimum<0>;
}

export interface EquipmentStats {
  hp: number & tags.Example<32>;
  atk: number & tags.Example<18>;
  def: number & tags.Example<14>;
  luck: number & tags.Example<6>;
}

export interface EquipmentSummary {
  total: EquipmentStats;
  equipmentBonus: EquipmentStats;
}

export interface EquippedItems {
  helmet?: EquipmentItem;
  armor?: EquipmentItem;
  weapon?: EquipmentItem;
  ring?: EquipmentItem;
  consumable?: EquipmentItem;
}

export interface InventoryResponse {
  version: number & tags.Minimum<0> & tags.Example<7>;
  items: EquipmentItem[];
  equipped: EquippedItems;
  summary: EquipmentSummary;
}
