import type { DungeonState } from '@prisma/client';
import type { FixtureDefinition, SnapshotStep } from './fixture.types';
import { FixtureRegistry } from './registry';

/**
 * REST 클램프 시나리오
 * seed: restfull2
 * 초기: hp 20/20 (full), floorProgress 10, ap1
 * 결과: REST에서 hp 변화 0(클램프), progress +10 → 20
 */
export const restClampSeed = 'restfull2';

export const restClampInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000108',
  level: 3,
  exp: 0,
  hp: 20,
  maxHp: 20,
  atk: 4,
  def: 2,
  luck: 1,
  levelUpPoints: 0,
  levelUpRollIndex: 0,
  equipmentBonus: null,
  statsVersion: 0,
  floor: 2,
  maxFloor: 2,
  floorProgress: 10,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const restClampSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'REST',
    stateAfter: {
      hp: 20,
      ap: 0,
      floor: 2,
      floorProgress: 20,
      level: 3,
      exp: 0,
      version: 2,
    },
    extra: [
      {
        action: 'REST',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 2,
        turnNumber: 0,
        delta: { type: 'REST', detail: { stats: { ap: -1 } } },
      },
      {
        action: 'REST',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 2,
        turnNumber: 0,
        delta: {
          type: 'REST',
          detail: {
            stats: { hp: 0 },
            progress: {
              previousProgress: 10,
              floorProgress: 20,
              delta: 10,
            },
          },
        },
      },
    ],
  },
];

/** @deprecated 하위 호환용. restClampFixture.steps 사용 권장 */
export const restClampSnapshot = {
  seed: restClampSeed,
  initialState: restClampInitialState,
  results: restClampSteps,
};

export const restClampFixture: FixtureDefinition = {
  meta: {
    name: 'rest-clamp',
    description: 'REST 클램프 시나리오: hp full 상태에서 hp 변화 0',
    snapshotPhase: 'post',
    tags: ['rest'],
  },
  seed: restClampSeed,
  initialState: restClampInitialState,
  steps: restClampSteps,
};

FixtureRegistry.register(restClampFixture);
