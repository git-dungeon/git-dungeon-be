type BattleResult = 'VICTORY' | 'DEFEAT';

export type BattleDetails = {
  type: 'BATTLE';
  details: {
    monster: {
      id: string;
      name: string;
      hp: number;
      atk: number;
      spriteId: string;
    };
    result?: BattleResult;
    cause?: string;
  };
};

export type DeathDetails = {
  type: 'DEATH';
  details: {
    cause: string;
    handledBy?: string;
  };
};

export type AcquireItemDetails = {
  type: 'ACQUIRE_ITEM';
  details: {
    reward: {
      source: string;
    };
  };
};

export type EquipItemDetails = {
  type: 'EQUIP_ITEM';
  details: {
    item: {
      id: string;
      code: string;
      name: string;
      rarity: string;
      modifiers: Array<{ stat: string; value: number }>;
    };
  };
};

export type LevelUpDetails = {
  type: 'LEVEL_UP';
  details: {
    previousLevel: number;
    currentLevel: number;
    threshold: number;
  };
};

export type BuffDetails = {
  type: 'BUFF_APPLIED' | 'BUFF_EXPIRED';
  details: {
    buffId: string;
    source?: string;
    spriteId?: string;
    effect?: string;
    totalTurns?: number | null;
    remainingTurns?: number | null;
    expiredAtTurn?: number;
    consumedBy?: string;
  };
};

export type DungeonLogDetails =
  | BattleDetails
  | DeathDetails
  | AcquireItemDetails
  | EquipItemDetails
  | LevelUpDetails
  | BuffDetails;

export const toJsonDetails = (details: DungeonLogDetails) => details;
