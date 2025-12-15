import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';
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
      { action: 'BATTLE', status: 'STARTED' },
      {
        action: 'BATTLE',
        status: 'COMPLETED',
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -1, exp: 3 },
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
              id: 'monster-giant-rat',
              name: 'Giant Rat',
              hp: 8,
              atk: 2,
              def: 0,
              spriteId: 'sprite/monster-giant-rat',
            },
            result: 'VICTORY',
            expGained: 3,
            turns: 2,
            damageDealt: 9,
            damageTaken: 1,
          },
        },
      },
      { action: 'MOVE', status: 'STARTED' },
      {
        action: 'MOVE',
        status: 'COMPLETED',
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
      {
        action: 'ACQUIRE_ITEM',
        status: 'COMPLETED',
        delta: {
          type: 'ACQUIRE_ITEM',
          detail: {
            inventory: {
              added: [
                {
                  itemId: deterministicUuidV5('inventory:weapon-battle-axe'),
                  code: 'weapon-battle-axe',
                  slot: 'weapon',
                  rarity: 'rare',
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
                    itemCode: 'weapon-battle-axe',
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      },
    ],
  },
];

export const forcedMoveSnapshot = {
  seed: forcedMoveSeed,
  initialState: forcedMoveInitialState,
  results: forcedMoveSteps,
};
