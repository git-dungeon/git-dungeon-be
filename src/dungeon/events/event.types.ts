import type {
  DungeonAction,
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  DungeonState,
} from '@prisma/client';
import type { DungeonLogDelta } from '../../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../../common/logs/dungeon-log-extra';
import type { DropResult } from '../drops/drop-table';

export enum DungeonEventType {
  BATTLE = 'BATTLE',
  TREASURE = 'TREASURE',
  REST = 'REST',
  TRAP = 'TRAP',
  MOVE = 'MOVE',
}

export type DungeonEventWeights = {
  [DungeonEventType.BATTLE]: number;
  [DungeonEventType.TREASURE]: number;
  [DungeonEventType.REST]: number;
  [DungeonEventType.TRAP]: number;
};

export const BASE_PROGRESS_INCREMENT = 10;
export const BATTLE_PROGRESS_INCREMENT = 20;
export const MAX_FLOOR_PROGRESS = 100;
export const DEFAULT_EVENT_WEIGHTS: DungeonEventWeights = {
  [DungeonEventType.BATTLE]: 50,
  [DungeonEventType.TREASURE]: 5,
  [DungeonEventType.REST]: 40,
  [DungeonEventType.TRAP]: 5,
};

export type DungeonEventContext = {
  state: DungeonState;
  seed: string;
  actionCounter?: number;
  apCost?: number;
  weights?: DungeonEventWeights;
};

export type DungeonEventLogStub = {
  type: DungeonEventType;
  status: 'STARTED' | 'COMPLETED';
  delta?: DungeonLogDelta;
  extra?: DungeonLogDetails;
  actionOverride?: DungeonLogAction;
  categoryOverride?: DungeonLogCategory;
};

export type DungeonLogPayload = {
  category: DungeonLogCategory;
  action: DungeonLogAction;
  status: DungeonLogStatus;
  floor: number;
  turnNumber?: number;
  stateVersionBefore?: number;
  stateVersionAfter?: number;
  delta?: DungeonLogDelta;
  extra?: DungeonLogDetails;
  createdAt: Date;
};

export type DungeonEventResult = {
  selectedEvent: DungeonEventType;
  forcedMove: boolean;
  stateBefore: DungeonState;
  stateAfter: DungeonState;
  rawLogs: DungeonEventLogStub[];
  logs: DungeonLogPayload[];
  drops?: DropResult[];
  inventoryAdds?: Array<{
    itemId: string;
    code: string;
    slot?: string;
    rarity?: string;
    quantity?: number;
  }>;
};

export type DungeonEventSelectionInput = {
  state: DungeonState;
  rngValue: number;
  weights: DungeonEventWeights;
};

export type DungeonEventSelector = {
  select(input: DungeonEventSelectionInput): DungeonEventType;
};

export type DungeonEventProcessorInput = {
  state: DungeonState;
  rngValue: number;
};

export type DungeonEventProcessorOutput = {
  state: DungeonState;
  delta?: DungeonLogDelta;
  extra?: DungeonLogDetails;
  expGained?: number;
  followUpLogs?: DungeonEventLogStub[];
  drops?: DropResult[];
  dropMeta?: {
    tableId?: string | null;
    isElite?: boolean;
    rolls?: number;
    items?: Array<{ itemCode: string; quantity?: number }>;
  };
};

export interface DungeonEventProcessor {
  readonly type: DungeonEventType;
  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput;
}

export type DungeonActionMapping = {
  [K in DungeonEventType]: DungeonAction;
};

export type EffectDelta = {
  stats?: Partial<{
    hp: number;
    ap: number;
    atk: number;
    def: number;
    luck: number;
  }>;
  rewards?: {
    gold?: number;
    items?: Array<{
      itemId: string;
      code: string;
      slot: string;
      rarity?: string;
      quantity?: number;
    }>;
    buffs?: Array<{
      buffId: string;
      source?: string;
      totalTurns?: number | null;
      remainingTurns?: number | null;
    }>;
  };
  scaling?: {
    hpRatio?: number; // 비율 회복/피해용(예: 0.3 → +30% maxHp)
  };
};
