import type { DungeonState } from '@prisma/client';
import type { FixtureDefinition, SnapshotStep } from './fixture.types';
import { FixtureRegistry } from './registry';
import { deterministicUuidV5 } from '../../../common/ids/deterministic-uuid';

/**
 * 강제 MOVE 시나리오
 * seed: force
 * 초기: progress 90, hp10/10, floor1, ap3
 * 결과: BATTLE 승리로 progress 100 → MOVE 강제, floor 2, version 단일 증가
 */
export const forcedMoveSeed = 'force';

export const forcedMoveInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000107',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 3,
  def: 1,
  luck: 1,
  floor: 1,
  maxFloor: 1,
  floorProgress: 90,
  gold: 0,
  ap: 3,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const forcedMoveSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 9,
      ap: 2,
      floor: 2,
      floorProgress: 0,
      level: 1,
      exp: 3,
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
        turnNumber: 0,
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -1, exp: 3 },
            rewards: {
              gold: 2,
              items: [{ code: 'ring-silver-band', quantity: 1 }],
            },
            progress: {
              previousProgress: 90,
              floorProgress: 100,
              delta: 10,
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
            expGained: 3,
            turns: 2,
            damageDealt: 9,
            damageTaken: 1,
          },
        },
      },
      {
        action: 'ACQUIRE_ITEM',
        status: 'COMPLETED',
        category: 'STATUS',
        floor: 1,
        turnNumber: 0,
        delta: {
          type: 'ACQUIRE_ITEM',
          detail: {
            inventory: {
              added: [
                {
                  itemId: deterministicUuidV5('inventory:ring-silver-band'),
                  code: 'ring-silver-band',
                  slot: 'ring',
                  rarity: 'common',
                  quantity: 1,
                },
              ],
            },
          },
        },
        extra: {
          type: 'ACQUIRE_ITEM',
          details: {
            reward: {
              source: 'BATTLE',
              drop: {
                tableId: 'drops-default',
                isElite: false,
                items: [
                  {
                    code: 'ring-silver-band',
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      },
      {
        action: 'MOVE',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 1,
        turnNumber: 0,
      },
      {
        action: 'MOVE',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 2,
        turnNumber: 0,
        delta: {
          type: 'MOVE',
          detail: {
            fromFloor: 1,
            toFloor: 2,
            previousProgress: 100,
            progress: {
              previousProgress: 100,
              floorProgress: 0,
              delta: -100,
            },
          },
        },
      },
    ],
  },
];

/** @deprecated 하위 호환용. forcedMoveFixture.steps 사용 권장 */
export const forcedMoveSnapshot = {
  seed: forcedMoveSeed,
  initialState: forcedMoveInitialState,
  results: forcedMoveSteps,
};

export const forcedMoveFixture: FixtureDefinition = {
  meta: {
    name: 'forced-move',
    description: '강제 MOVE 시나리오: progress 100 → floor 이동',
    snapshotPhase: 'post',
    tags: ['move', 'floor'],
  },
  seed: forcedMoveSeed,
  initialState: forcedMoveInitialState,
  steps: forcedMoveSteps,
};

FixtureRegistry.register(forcedMoveFixture);
