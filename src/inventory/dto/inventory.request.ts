export interface InventoryItemMutationRequest {
  itemId: string;
  expectedVersion: number;
  inventoryVersion: number;
  quantity?: number;
}
