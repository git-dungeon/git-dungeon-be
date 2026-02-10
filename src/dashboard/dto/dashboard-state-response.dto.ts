import type { InventoryModifier } from '../../common/inventory/inventory-modifier';

export interface EquipmentItem {
  id: string;
  code: string;
  name?: string | null;
  slot: string;
  rarity: string;
  modifiers: InventoryModifier[];
  effect?: string | null;
  sprite?: string | null;
  createdAt: string;
  isEquipped: boolean;
  version: number;
}

export interface StatBlock {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
}

export interface StatBreakdown {
  base: StatBlock;
  equipmentBonus: StatBlock;
  total: StatBlock;
}

export interface DashboardState {
  userId: string;
  level: number;
  exp: number;
  levelUpPoints: number;
  unopenedChests: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  floor: number;
  maxFloor: number;
  floorProgress: number;
  gold: number;
  ap: number;
  currentAction: string;
  currentActionStartedAt: string | null;
  createdAt: string;
  version: number;
  updatedAt: string;
  expToLevel: number | null;
  stats: StatBreakdown;
  equippedItems: EquipmentItem[];
}

export interface DashboardStateResponse {
  state: DashboardState;
}
