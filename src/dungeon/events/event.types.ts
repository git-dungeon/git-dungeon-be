import type { DungeonAction, DungeonState } from '@prisma/client';

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

export const DEFAULT_EVENT_WEIGHTS: DungeonEventWeights = {
  [DungeonEventType.BATTLE]: 50,
  [DungeonEventType.TREASURE]: 5,
  [DungeonEventType.REST]: 40,
  [DungeonEventType.TRAP]: 5,
};

export const BASE_PROGRESS_INCREMENT = 10;
export const BATTLE_PROGRESS_INCREMENT = 20;
export const MAX_FLOOR_PROGRESS = 100;
export const REST_HEAL_RATIO = 0.3; // PRD: 휴식만 HP 회복, 기본 30% 회복
export const REST_MIN_HEAL = 2;
export const TRAP_BASE_DAMAGE = 3;

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
  delta?: unknown;
  extra?: unknown;
};

export type DungeonEventResult = {
  selectedEvent: DungeonEventType;
  forcedMove: boolean;
  stateBefore: DungeonState;
  stateAfter: DungeonState;
  logs: DungeonEventLogStub[];
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
  delta?: unknown;
  extra?: unknown;
};

export interface DungeonEventProcessor {
  readonly type: DungeonEventType;
  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput;
}

export type DungeonActionMapping = {
  [K in DungeonEventType]: DungeonAction;
};
