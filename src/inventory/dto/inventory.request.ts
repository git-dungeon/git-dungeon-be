import { tags } from 'typia';

export interface InventoryItemMutationRequest {
  itemId: string &
    tags.Format<'uuid'> &
    tags.Example<'11111111-1111-4111-8111-111111111111'>;
  expectedVersion: number & tags.Minimum<0> & tags.Example<3>;
  inventoryVersion: number & tags.Minimum<0> & tags.Example<7>;
  quantity?: number & tags.Minimum<1> & tags.Example<2>;
}
