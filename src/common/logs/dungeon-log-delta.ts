export type StatsDelta = Partial<{
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  ap: number;
  level: number;
}>;

export type InventoryDelta = {
  added?: Array<{
    itemId: string;
    code: string;
    slot: string;
    rarity?: string;
    quantity?: number;
  }>;
  removed?: Array<{ itemId: string; code: string; quantity?: number }>;
  equipped?: { slot: string; itemId: string; code: string };
  unequipped?: { slot: string; itemId: string; code: string };
};

export type BuffAppliedDelta = {
  type: 'BUFF_APPLIED';
  detail: {
    applied: Array<{
      buffId: string;
      source?: string;
      totalTurns?: number | null;
      remainingTurns?: number | null;
    }>;
  };
};

export type BuffExpiredDelta = {
  type: 'BUFF_EXPIRED';
  detail: {
    expired: Array<{
      buffId: string;
      expiredAtTurn?: number;
      consumedBy?: string;
    }>;
  };
};

export type BuffsDelta = BuffAppliedDelta | BuffExpiredDelta;

export type ProgressDelta = Partial<{
  floor: number;
  floorProgress: number;
}>;

export type RewardsDelta = {
  skillPoints?: number;
  unlocks?: string[];
};

export type BattleDelta = {
  type: 'BATTLE';
  detail: {
    stats?: StatsDelta;
    gold?: number;
  };
};

export type DeathDelta = {
  type: 'DEATH';
  detail: {
    stats: StatsDelta;
    progress: ProgressDelta;
    buffs?: BuffExpiredDelta['detail']['expired'];
  };
};

export type AcquireItemDelta = {
  type: 'ACQUIRE_ITEM';
  detail: {
    inventory: InventoryDelta;
  };
};

export type EquipItemDelta = {
  type: 'EQUIP_ITEM' | 'UNEQUIP_ITEM' | 'DISCARD_ITEM';
  detail: {
    inventory: InventoryDelta;
    stats?: StatsDelta;
  };
};

export type LevelUpDelta = {
  type: 'LEVEL_UP';
  detail: {
    stats: StatsDelta;
    rewards?: RewardsDelta;
  };
};

export type BuffDelta =
  | {
      type: 'BUFF_APPLIED';
      detail: BuffAppliedDelta['detail'];
    }
  | {
      type: 'BUFF_EXPIRED';
      detail: BuffExpiredDelta['detail'];
    };

export type DungeonLogDelta =
  | BattleDelta
  | DeathDelta
  | AcquireItemDelta
  | EquipItemDelta
  | LevelUpDelta
  | BuffDelta;

export const toJsonDelta = (delta: DungeonLogDelta) => delta;
