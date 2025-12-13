import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';

/**
 * 패배(no-drop) 시나리오
 * seed: nodrop
 * 초기: hp3/10, atk1, def0, floor1, ap1
 * 결과: BATTLE 패배 → DEATH, progress 0, 드랍/ACQUIRE_ITEM 없음
 */
export const noDropSeed = 'nodrop';

export const noDropInitialState: DungeonState = {
  userId: 'user-nodrop',
  level: 1,
  exp: 0,
  hp: 3,
  maxHp: 10,
  atk: 1,
  def: 0,
  luck: 0,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const noDropSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 10,
      ap: 0,
      floor: 1,
      floorProgress: 0,
      level: 1,
      exp: 0,
      version: 2,
    },
    extra: [
      { action: 'BATTLE', status: 'STARTED' },
      {
        action: 'DEATH',
        status: 'COMPLETED',
        delta: {
          type: 'DEATH',
          detail: {
            stats: { hp: 10 },
            progress: {
              previousProgress: 20,
              floorProgress: 0,
              delta: -20,
            },
          },
        },
        extra: {
          type: 'DEATH',
          details: {
            cause: 'PLAYER_DEFEATED',
          },
        },
      },
      {
        action: 'BATTLE',
        status: 'COMPLETED',
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -3 },
            progress: {
              previousProgress: 0,
              floorProgress: 0,
              delta: 0,
            },
          },
        },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              id: 'monster-giant-rat',
              name: 'Giant Rat',
              hp: 8,
              atk: 2,
              def: 0,
              spriteId: 'sprite/monster-giant-rat',
            },
            result: 'DEFEAT',
            cause: 'PLAYER_DEFEATED',
            expGained: 0,
            turns: 2,
            damageDealt: 2,
            damageTaken: 4,
          },
        },
      },
    ],
  },
];

export const noDropSnapshot = {
  seed: noDropSeed,
  initialState: noDropInitialState,
  results: noDropSteps,
};
