import type { DungeonState } from '@prisma/client';
import type { DungeonEventType } from '../dungeon/events/event.types';
import type { SnapshotStep } from '../test-support/dungeon/fixtures/fixture.types';

export type SimulationLog = {
  action: string;
  status: string;
  delta: unknown;
  extra: unknown;
  category?: string;
  floor?: number | null;
  turnNumber?: number | null;
};

export type SimulationStep = {
  actionCounter: number;
  selectedEvent: DungeonEventType;
  stateAfter: Pick<
    DungeonState,
    'hp' | 'ap' | 'floor' | 'floorProgress' | 'level' | 'exp' | 'version'
  >;
  logs: SimulationLog[];
};

export type SimulationSummary = {
  actionsAttempted: number;
  actionsCompleted: number;
  apConsumed: number;
  durationMs: number;
  initialVersion: number;
  finalVersion: number;
  finalAp: number;
  finalFloor: number;
  finalProgress: number;
};

export type SimulationResult = {
  steps: SimulationStep[];
  summary: SimulationSummary;
  fixtureCheck?: {
    name: string;
    passed: boolean;
    mismatches: string[];
  };
};

export type SimulationSnapshot = {
  seed: string;
  initialState: DungeonState;
  results: SnapshotStep[];
};
