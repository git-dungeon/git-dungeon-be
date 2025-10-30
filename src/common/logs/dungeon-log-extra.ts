import type { DungeonLogAction } from '@prisma/client';

type BattleResult = 'VICTORY' | 'DEFEAT';

export type BattleExtra = {
  type: 'BATTLE';
  detail: {
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

export type DeathExtra = {
  type: 'DEATH';
  detail: {
    cause: string;
    handledBy?: string;
  };
};

export type AcquireItemExtra = {
  type: 'ACQUIRE_ITEM';
  detail: {
    reward: {
      source: string;
    };
  };
};

export type EquipItemExtra = {
  type: 'EQUIP_ITEM';
  detail: {
    item: {
      id: string;
      name: string;
      rarity: string;
      modifiers: Array<{ stat: string; value: number }>;
    };
  };
};

export type LevelUpExtra = {
  type: 'LEVEL_UP';
  detail: {
    previousLevel: number;
    currentLevel: number;
    threshold: number;
  };
};

export type BuffExtra = {
  type: 'BUFF_APPLIED' | 'BUFF_EXPIRED';
  detail: {
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

export type DungeonLogExtra =
  | BattleExtra
  | DeathExtra
  | AcquireItemExtra
  | EquipItemExtra
  | LevelUpExtra
  | BuffExtra;

export const toJsonExtra = (extra: DungeonLogExtra) => extra;

export type DungeonLogActionForExtra =
  | DungeonLogExtra['type']
  | DungeonLogAction;
