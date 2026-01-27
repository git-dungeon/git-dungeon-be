import { tags } from 'typia';
import type {
  InventoryRarity,
  InventorySlot,
} from '../../inventory/dto/inventory.response';

export interface ChestOpenItem {
  itemId: string &
    tags.Format<'uuid'> &
    tags.Example<'11111111-1111-4111-8111-111111111111'>;
  code: string & tags.Example<'weapon-longsword'>;
  slot: InventorySlot & tags.Example<'weapon'>;
  rarity: InventoryRarity & tags.Example<'rare'>;
  quantity: number & tags.Minimum<1> & tags.Example<1>;
}

export interface ChestOpenResponse {
  remainingChests: number & tags.Minimum<0> & tags.Example<2>;
  rollIndex: number & tags.Minimum<0> & tags.Example<5>;
  items: ChestOpenItem[];
}
