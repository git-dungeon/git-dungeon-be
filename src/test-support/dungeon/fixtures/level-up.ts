import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';
import { deterministicUuidV5 } from '../../../common/ids/deterministic-uuid';

/**
 * 연속 레벨업(2회) + 레전더리 드랍 시나리오
 * seed: lvlup18
 * 초기: level1, hp60/60, atk35, def12, luck5, floor80, progress0, ap1
 * 결과: exp 39 → 레벨업 2회(→3), 스탯/HP 증가, progress +20, 레전더리 angel-ring 드랍
 */
export const levelUpSeed = 'lvlup18';

export const levelUpInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000109',
  level: 1,
  exp: 0,
  hp: 60,
  maxHp: 60,
  atk: 35,
  def: 12,
  luck: 5,
  floor: 80,
  maxFloor: 80,
  floorProgress: 0,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const levelUpSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 45,
      ap: 0,
      floor: 80,
      floorProgress: 20,
      level: 3,
      exp: 9,
      version: 2,
    },
    extra: [
      { action: 'BATTLE', status: 'STARTED' },
      {
        action: 'LEVEL_UP',
        status: 'COMPLETED',
        delta: {
          type: 'LEVEL_UP',
          detail: {
            stats: {
              level: 1,
              luck: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
        extra: {
          type: 'LEVEL_UP',
          details: {
            previousLevel: 1,
            currentLevel: 2,
            threshold: 10,
            statsGained: {
              luck: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
      },
      {
        action: 'LEVEL_UP',
        status: 'COMPLETED',
        delta: {
          type: 'LEVEL_UP',
          detail: {
            stats: {
              level: 1,
              atk: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
        extra: {
          type: 'LEVEL_UP',
          details: {
            previousLevel: 2,
            currentLevel: 3,
            threshold: 20,
            statsGained: {
              atk: 1,
              maxHp: 2,
              hp: 2,
            },
          },
        },
      },
      {
        action: 'BATTLE',
        status: 'COMPLETED',
        delta: {
          type: 'BATTLE',
          detail: {
            stats: {
              hp: -15,
              maxHp: 4,
              atk: 1,
              luck: 1,
              level: 2,
              exp: 39,
            },
            progress: {
              previousProgress: 0,
              floorProgress: 20,
              delta: 20,
            },
          },
        },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              id: 'monster-ancient-dragon',
              name: 'Ancient Dragon',
              hp: 90,
              atk: 18,
              def: 9,
              spriteId: 'sprite/monster-ancient-dragon',
            },
            result: 'VICTORY',
            expGained: 39,
            turns: 4,
            damageDealt: 101,
            damageTaken: 19,
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
                  itemId: deterministicUuidV5('inventory:angel-ring'),
                  code: 'angel-ring',
                  slot: 'ring',
                  rarity: 'legendary',
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
                tableId: 'drops-ancient-dragon',
                isElite: false,
                items: [{ itemCode: 'angel-ring', quantity: 1 }],
              },
            },
          },
        },
      },
    ],
  },
];

export const levelUpSnapshot = {
  seed: levelUpSeed,
  initialState: levelUpInitialState,
  results: levelUpSteps,
};
