import { tags } from 'typia';

export interface InventoryItemMutationRequest {
  itemId: string & tags.MinLength<1> & tags.Example<'weapon-longsword'>;
  expectedVersion: number & tags.Minimum<0> & tags.Example<3>;
  inventoryVersion: number & tags.Minimum<0> & tags.Example<7>;
}
