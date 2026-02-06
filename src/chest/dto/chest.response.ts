import type {
  InventoryRarity,
  InventorySlot,
} from '../../inventory/dto/inventory.response';

export interface ChestOpenItem {
  itemId: string;
  code: string;
  slot: InventorySlot;
  rarity: InventoryRarity;
  quantity: number;
}

export interface ChestOpenResponse {
  remainingChests: number;
  rollIndex: number;
  items: ChestOpenItem[];
}
