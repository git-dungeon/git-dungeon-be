import type { InventoryModifier } from '../inventory/inventory-modifier';

// DEATH 로그 원인 코드(OpenAPI enum과 일치)
// PLAYER_DEFEATED: 전투 패배 사망, TRAP_DAMAGE: 함정 사망, HP_DEPLETED: 기타 체력 소진
export const DEATH_CAUSE_VALUES = [
  'PLAYER_DEFEATED',
  'TRAP_DAMAGE',
  'HP_DEPLETED',
] as const;
export type DeathCause = (typeof DEATH_CAUSE_VALUES)[number];

type BattleResult = 'VICTORY' | 'DEFEAT';

type BattlePlayerStatBlock = {
  hp: number;
  atk: number;
  def: number;
  luck: number;
};

type BattlePlayerStatBreakdown = {
  base: BattlePlayerStatBlock;
  equipmentBonus: BattlePlayerStatBlock;
  total: BattlePlayerStatBlock;
};

export type BattlePlayerSnapshot = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  stats: BattlePlayerStatBreakdown;
  level: number;
  exp: number;
  expToLevel?: number;
};

export type BattleDetails = {
  type: 'BATTLE';
  details: {
    monster: {
      code: string;
      name: string;
      hp: number;
      atk: number;
      def: number;
      spriteId: string;
    };
    player: BattlePlayerSnapshot;
    result?: BattleResult;
    cause?: string;
    expGained?: number;
    turns?: number;
    damageDealt?: number;
    damageTaken?: number;
  };
};

export type DeathDetails = {
  type: 'DEATH';
  details: {
    cause: DeathCause;
    handledBy?: string;
  };
};

export type AcquireItemDetails = {
  type: 'ACQUIRE_ITEM';
  details: {
    reward: {
      source: string;
      drop?: {
        tableId?: string | null;
        isElite?: boolean;
        items?: Array<{
          code: string;
          quantity?: number;
        }>;
      };
    };
  };
};

export type InventoryMutationDetails = {
  type: 'EQUIP_ITEM' | 'UNEQUIP_ITEM' | 'DISCARD_ITEM';
  details: {
    item: {
      id: string;
      code: string;
      slot: string;
      rarity: string;
      name?: string | null;
      modifiers?: InventoryModifier[];
    };
    replacedItem?: {
      id: string;
      code: string;
      slot: string;
      rarity: string;
      name?: string | null;
    };
  };
};

export type LevelUpDetails = {
  type: 'LEVEL_UP';
  details: {
    previousLevel: number;
    currentLevel: number;
    threshold: number;
    statsGained: Partial<{
      hp: number;
      maxHp: number;
      atk: number;
      def: number;
      luck: number;
    }>;
  };
};

export type RestDetails = {
  type: 'REST';
  details: {
    source?: string;
  };
};

export type TrapDetails = {
  type: 'TRAP';
  details: {
    trapCode?: string;
  };
};

export type TreasureDetails = {
  type: 'TREASURE';
  details: {
    rewardCode?: string;
    rarity?: string;
  };
};

export type MoveDetails = {
  type: 'MOVE';
  details: {
    rewards?: {
      gold?: number;
      buff?: Record<string, unknown>;
    };
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
  | InventoryMutationDetails
  | LevelUpDetails
  | BuffDetails
  | RestDetails
  | TrapDetails
  | TreasureDetails
  | MoveDetails;

export const toJsonDetails = (details: DungeonLogDetails) => details;
