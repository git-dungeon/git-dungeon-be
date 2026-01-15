import type { DungeonState } from '@prisma/client';
import type { FixtureDefinition, SnapshotStep } from './fixture.types';
import { FixtureRegistry } from './registry';

/**
 * 기본 시나리오
 * seed: baseline
 * 흐름: REST → REST → BATTLE 승리, 진행도 0→40
 */
export const baselineSeed = 'baseline';

export const baselineInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000101',
  level: 1,
  exp: 0,
  hp: 6,
  maxHp: 10,
  atk: 3,
  def: 1,
  luck: 1,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 5,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

// SnapshotStep 타입은 fixture.types.ts에서 import

export const baselineSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'REST',
    stateAfter: {
      hp: 10,
      ap: 4,
      floor: 1,
      floorProgress: 10,
      level: 1,
      exp: 0,
      version: 2,
    },
    extra: [
      {
        action: 'REST',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
        delta: { type: 'REST', detail: { stats: { ap: -1 } } },
      },
      {
        action: 'REST',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
        delta: {
          type: 'REST',
          detail: {
            stats: { hp: 4 },
            progress: {
              previousProgress: 0,
              floorProgress: 10,
              delta: 10,
            },
          },
        },
      },
    ],
  },
  {
    actionCounter: 1,
    selectedEvent: 'REST',
    stateAfter: {
      hp: 10,
      ap: 3,
      floor: 1,
      floorProgress: 20,
      level: 1,
      exp: 0,
      version: 3,
    },
    extra: [
      {
        action: 'REST',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 1,
        delta: { type: 'REST', detail: { stats: { ap: -1 } } },
      },
      {
        action: 'REST',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 1,
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
  {
    actionCounter: 2,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 9,
      ap: 2,
      floor: 1,
      floorProgress: 40,
      level: 1,
      exp: 3,
      version: 4,
    },
    extra: [
      {
        action: 'BATTLE',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 2,
        delta: { type: 'BATTLE', detail: { stats: { ap: -1 } } },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              code: 'monster-giant-rat',
              name: 'Giant Rat',
              hp: 8,
              atk: 2,
              def: 0,
              spriteId: 'sprite/monster-giant-rat',
            },
            player: {
              hp: 10,
              maxHp: 10,
              atk: 3,
              def: 1,
              luck: 1,
              stats: {
                base: { hp: 10, maxHp: 10, atk: 3, def: 1, luck: 1 },
                equipmentBonus: {
                  hp: 0,
                  maxHp: 0,
                  atk: 0,
                  def: 0,
                  luck: 0,
                },
                total: { hp: 10, maxHp: 10, atk: 3, def: 1, luck: 1 },
              },
              level: 1,
              exp: 0,
              expToLevel: 10,
            },
          },
        },
      },
      {
        action: 'BATTLE',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 2,
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -1, exp: 3 },
            rewards: {
              gold: 2,
            },
            progress: {
              previousProgress: 20,
              floorProgress: 40,
              delta: 20,
            },
          },
        },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              code: 'monster-giant-rat',
              name: 'Giant Rat',
              hp: 8,
              atk: 2,
              def: 0,
              spriteId: 'sprite/monster-giant-rat',
            },
            player: {
              hp: 9,
              maxHp: 10,
              atk: 3,
              def: 1,
              luck: 1,
              stats: {
                base: { hp: 10, maxHp: 10, atk: 3, def: 1, luck: 1 },
                equipmentBonus: {
                  hp: 0,
                  maxHp: 0,
                  atk: 0,
                  def: 0,
                  luck: 0,
                },
                total: { hp: 10, maxHp: 10, atk: 3, def: 1, luck: 1 },
              },
              level: 1,
              exp: 3,
              expToLevel: 10,
            },
            result: 'VICTORY',
            cause: 'CRITICAL_HIT',
            expGained: 3,
            turns: 2,
            damageDealt: 9,
            damageTaken: 1,
          },
        },
      },
    ],
  },
];

/** @deprecated 하위 호환용. baselineFixture.steps 사용 권장 */
export const baselineSnapshot = {
  seed: baselineSeed,
  initialState: baselineInitialState,
  results: baselineSteps,
};

/**
 * Baseline fixture 정의 (메타데이터 포함)
 */
export const baselineFixture: FixtureDefinition = {
  meta: {
    name: 'baseline',
    description: '기본 시나리오: REST → REST → BATTLE 승리, 진행도 0→40',
    snapshotPhase: 'post',
    tags: ['basic'],
  },
  seed: baselineSeed,
  initialState: baselineInitialState,
  steps: baselineSteps,
};

// 레지스트리 자동 등록
FixtureRegistry.register(baselineFixture);
