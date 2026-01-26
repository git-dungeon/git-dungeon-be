import type { DungeonState } from '@prisma/client';
import type { FixtureDefinition, SnapshotStep } from './fixture.types';
import { FixtureRegistry } from './registry';

/**
 * 패배(no-drop) 시나리오
 * seed: nodrop
 * 초기: hp3/10, atk1, def0, floor1, ap1
 * 결과: BATTLE 패배 → DEATH + REVIVE, progress 0, 드랍/상자 보상 없음
 */
export const noDropSeed = 'nodrop';

export const noDropInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000102',
  level: 1,
  exp: 0,
  hp: 3,
  maxHp: 10,
  atk: 1,
  def: 0,
  luck: 0,
  levelUpPoints: 0,
  levelUpRollIndex: 0,
  unopenedChests: 0,
  chestRollIndex: 0,
  equipmentBonus: null,
  statsVersion: 0,
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
      {
        action: 'BATTLE',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
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
              hp: 3,
              maxHp: 10,
              atk: 1,
              def: 0,
              luck: 0,
              stats: {
                base: { hp: 10, maxHp: 10, atk: 1, def: 0, luck: 0 },
                equipmentBonus: {
                  hp: 0,
                  maxHp: 0,
                  atk: 0,
                  def: 0,
                  luck: 0,
                },
                total: { hp: 10, maxHp: 10, atk: 1, def: 0, luck: 0 },
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
        turnNumber: 0,
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -3 },
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
              hp: 0,
              maxHp: 10,
              atk: 1,
              def: 0,
              luck: 0,
              stats: {
                base: { hp: 10, maxHp: 10, atk: 1, def: 0, luck: 0 },
                equipmentBonus: {
                  hp: 0,
                  maxHp: 0,
                  atk: 0,
                  def: 0,
                  luck: 0,
                },
                total: { hp: 10, maxHp: 10, atk: 1, def: 0, luck: 0 },
              },
              level: 1,
              exp: 0,
              expToLevel: 10,
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
      {
        action: 'DEATH',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
        delta: {
          type: 'DEATH',
          detail: {
            stats: {},
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
            handledBy: 'monster-giant-rat',
          },
        },
      },
      {
        action: 'REVIVE',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
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

/** @deprecated 하위 호환용. noDropFixture.steps 사용 권장 */
export const noDropSnapshot = {
  seed: noDropSeed,
  initialState: noDropInitialState,
  results: noDropSteps,
};

export const noDropFixture: FixtureDefinition = {
  meta: {
    name: 'no-drop',
    description: '패배(no-drop) 시나리오: BATTLE 패배 → DEATH + REVIVE',
    snapshotPhase: 'post',
    tags: ['death', 'battle'],
  },
  seed: noDropSeed,
  initialState: noDropInitialState,
  steps: noDropSteps,
};

FixtureRegistry.register(noDropFixture);
