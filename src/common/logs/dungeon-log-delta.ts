export type StatsDelta = Partial<{
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  ap: number;
  level: number;
  exp: number;
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
  previousProgress?: number;
  delta?: number;
}>;

export type RewardsDelta = {
  gold?: number;
  items?: Array<{
    code: string;
    quantity?: number;
  }>; // 이벤트(BATTLE/TREASURE) 보상: 카탈로그 기준 (인벤토리 SSOT는 ACQUIRE_ITEM)
  buffs?: BuffAppliedDelta['detail']['applied'];
  unlocks?: string[];
};

export type BattleDelta = {
  type: 'BATTLE';
  detail: {
    stats?: StatsDelta;
    rewards?: RewardsDelta;
    progress?: ProgressDelta;
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

export type ReviveDelta = {
  type: 'REVIVE';
  detail: {
    stats: StatsDelta;
  };
};

export type RestDelta = {
  type: 'REST';
  detail: {
    stats: StatsDelta;
    progress?: ProgressDelta;
  };
};

export type TrapDelta = {
  type: 'TRAP';
  detail: {
    stats: StatsDelta;
    progress?: ProgressDelta;
  };
};

export type TreasureDelta = {
  type: 'TREASURE';
  detail: {
    stats?: StatsDelta;
    rewards?: RewardsDelta;
    progress?: ProgressDelta;
  };
};

export type MoveDelta = {
  type: 'MOVE';
  detail: {
    fromFloor: number;
    toFloor: number;
    previousProgress: number;
    progress: ProgressDelta;
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
  | ReviveDelta
  | AcquireItemDelta
  | EquipItemDelta
  | LevelUpDelta
  | BuffDelta
  | RestDelta
  | TrapDelta
  | TreasureDelta
  | MoveDelta;

export const toJsonDelta = (delta: DungeonLogDelta) => delta;
