import type { InventoryModifier } from '../../common/inventory/inventory-modifier';
import { tags } from 'typia';

export interface EquipmentItem {
  id: string & tags.Example<'weapon-longsword'>;
  code: string & tags.Example<'weapon-longsword'>;
  name?: (string & tags.Example<'Longsword'>) | null;
  slot: string & tags.Example<'weapon'>;
  rarity: string & tags.Example<'rare'>;
  modifiers: InventoryModifier[];
  effect?: (string & tags.Example<'bleed-1'>) | null;
  sprite?: (string & tags.Example<'sprite/weapon-longsword.svg'>) | null;
  createdAt: string & tags.Format<'date-time'>;
  isEquipped: boolean & tags.Example<true>;
  version: number & tags.Minimum<1>;
}

export interface StatBlock {
  hp: number & tags.Example<32>;
  maxHp: number & tags.Example<40>;
  atk: number & tags.Example<18>;
  def: number & tags.Example<14>;
  luck: number & tags.Example<6>;
}

export interface StatBreakdown {
  base: StatBlock;
  equipmentBonus: StatBlock;
  total: StatBlock;
}

export interface DashboardState {
  userId: string & tags.Format<'uuid'>;
  level: number & tags.Minimum<1> & tags.Example<8>;
  exp: number & tags.Minimum<0> & tags.Example<54>;
  levelUpPoints: number & tags.Minimum<0> & tags.Example<2>;
  unopenedChests: number & tags.Minimum<0> & tags.Example<1>;
  hp: number & tags.Example<32>;
  maxHp: number & tags.Example<40>;
  atk: number & tags.Example<18>;
  def: number & tags.Example<14>;
  luck: number & tags.Example<6>;
  floor: number & tags.Example<13>;
  maxFloor: number & tags.Example<15>;
  floorProgress: number &
    tags.Minimum<0> &
    tags.Maximum<100> &
    tags.Example<60>;
  gold: number & tags.Example<640>;
  ap: number & tags.Example<18>;
  currentAction: string & tags.Example<'BATTLE'>;
  currentActionStartedAt: (string & tags.Format<'date-time'>) | null;
  createdAt: string & tags.Format<'date-time'>;
  version: number & tags.Minimum<1>;
  updatedAt: string & tags.Format<'date-time'>;
  expToLevel: (number & tags.Minimum<1>) | null;
  stats: StatBreakdown;
  equippedItems: EquipmentItem[];
}

export interface DashboardStateResponse {
  state: DashboardState;
}
