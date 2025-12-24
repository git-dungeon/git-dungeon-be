import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';
import { deterministicUuidV5 } from '../../../common/ids/deterministic-uuid';

/**
 * 장기 전투(6턴) 지표용 시나리오
 * seed: t0
 * 초기: hp10/10, atk1, def5, floor5? (actually floor1?), progress20, ap1
 * 결과: 6턴 승리, exp+3, progress +20 → 40, 드랍 ring-silver-band
 */
export const longBattleSeed = 't0';

export const longBattleInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000105',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 5,
  luck: 0,
  floor: 1,
  maxFloor: 1,
  floorProgress: 20,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const longBattleSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 5,
      ap: 0,
      floor: 1,
      floorProgress: 40,
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
            stats: { hp: -5, exp: 3 },
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
            result: 'VICTORY',
            expGained: 3,
            turns: 6,
            damageDealt: 8,
            damageTaken: 5,
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
    ],
  },
];

export const longBattleSnapshot = {
  seed: longBattleSeed,
  initialState: longBattleInitialState,
  results: longBattleSteps,
};
