import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';

/**
 * TRAP 사망 시나리오
 * seed: s15
 * 초기: hp3/10, progress0, ap2
 * 결과: TRAP 피해로 사망 → DEATH + REVIVE 로그, progress 리셋, hp 회복은 REVIVE에서 표현
 */
export const trapDeathSeed = 's15';

export const trapDeathInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000103',
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
  ap: 2,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const trapDeathSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'TRAP',
    stateAfter: {
      hp: 10,
      ap: 1,
      floor: 1,
      floorProgress: 0,
      level: 1,
      exp: 0,
      version: 2,
    },
    extra: [
      { action: 'TRAP', status: 'STARTED' },
      {
        action: 'TRAP',
        status: 'COMPLETED',
        delta: {
          type: 'TRAP',
          detail: {
            stats: { hp: -3 },
          },
        },
      },
      {
        action: 'DEATH',
        status: 'COMPLETED',
        delta: {
          type: 'DEATH',
          detail: {
            stats: {},
            progress: {
              previousProgress: 0,
              floorProgress: 0,
              delta: 0,
            },
          },
        },
        extra: {
          type: 'DEATH',
          details: {
            cause: 'TRAP_DAMAGE',
          },
        },
      },
      {
        action: 'REVIVE',
        status: 'COMPLETED',
        delta: {
          type: 'REVIVE',
          detail: {
            stats: { hp: 10 },
          },
        },
      },
    ],
  },
];

export const trapDeathSnapshot = {
  seed: trapDeathSeed,
  initialState: trapDeathInitialState,
  results: trapDeathSteps,
};
