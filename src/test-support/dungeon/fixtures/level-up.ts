import type { DungeonState } from '@prisma/client';
import type { FixtureDefinition, SnapshotStep } from './fixture.types';
import { FixtureRegistry } from './registry';
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
      {
        action: 'BATTLE',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 80,
        turnNumber: 0,
        delta: { type: 'BATTLE', detail: { stats: { ap: -1 } } },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              code: 'monster-ancient-dragon',
              name: 'Ancient Dragon',
              hp: 90,
              atk: 18,
              def: 9,
              spriteId: 'sprite/monster-ancient-dragon',
            },
            player: {
              hp: 60,
              maxHp: 60,
              atk: 35,
              def: 12,
              luck: 5,
              stats: {
                base: { hp: 60, atk: 35, def: 12, luck: 5 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 60, atk: 35, def: 12, luck: 5 },
              },
              level: 1,
              exp: 0,
              expToLevel: 10,
            },
          },
        },
      },
      {
        action: 'LEVEL_UP',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 80,
        turnNumber: 0,
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
        category: 'EXPLORATION',
        floor: 80,
        turnNumber: 0,
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
        category: 'EXPLORATION',
        floor: 80,
        turnNumber: 0,
        // 레벨업 로그는 이후에 기록되므로 전투 로그의 스냅샷은 레벨업 이전 상태를 유지한다.
        delta: {
          type: 'BATTLE',
          detail: {
            stats: {
              hp: -15,
              exp: 39,
            },
            rewards: {
              items: [{ code: 'angel-ring', quantity: 1 }],
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
              code: 'monster-ancient-dragon',
              name: 'Ancient Dragon',
              hp: 90,
              atk: 18,
              def: 9,
              spriteId: 'sprite/monster-ancient-dragon',
            },
            player: {
              hp: 45,
              maxHp: 60,
              atk: 35,
              def: 12,
              luck: 5,
              stats: {
                base: { hp: 60, atk: 35, def: 12, luck: 5 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 60, atk: 35, def: 12, luck: 5 },
              },
              level: 1,
              exp: 39,
              expToLevel: 10,
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
        category: 'STATUS',
        floor: 80,
        turnNumber: 0,
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
                items: [{ code: 'angel-ring', quantity: 1 }],
              },
            },
          },
        },
      },
    ],
  },
];

/** @deprecated 하위 호환용. levelUpFixture.steps 사용 권장 */
export const levelUpSnapshot = {
  seed: levelUpSeed,
  initialState: levelUpInitialState,
  results: levelUpSteps,
};

export const levelUpFixture: FixtureDefinition = {
  meta: {
    name: 'level-up',
    description: '연속 레벨업(2회) + 레전더리 드랍 시나리오',
    snapshotPhase: 'post',
    tags: ['battle', 'level-up', 'drop'],
  },
  seed: levelUpSeed,
  initialState: levelUpInitialState,
  steps: levelUpSteps,
};

FixtureRegistry.register(levelUpFixture);
