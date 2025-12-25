import type { DungeonState } from '@prisma/client';
import { deterministicUuidV5 } from '../../../common/ids/deterministic-uuid';

/**
 * 기본 시나리오
 * seed: baseline
 * 흐름: TREASURE → REST → BATTLE 승리, 진행도 0→40, 드랍 ring-topaz 2회
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

export type SnapshotStep = {
  actionCounter: number;
  selectedEvent: 'TREASURE' | 'REST' | 'BATTLE' | 'TRAP' | 'MOVE';
  stateAfter: Pick<
    DungeonState,
    'hp' | 'ap' | 'floor' | 'floorProgress' | 'level' | 'exp' | 'version'
  >;
  extra: Array<{
    action: string;
    status: string;
    delta?: unknown;
    extra?: unknown;
  }>;
};

export const baselineSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'TREASURE',
    stateAfter: {
      hp: 6,
      ap: 4,
      floor: 1,
      floorProgress: 10,
      level: 1,
      exp: 0,
      version: 2,
    },
    extra: [
      {
        action: 'TREASURE',
        status: 'STARTED',
        delta: { type: 'TREASURE', detail: { stats: { ap: -1 } } },
      },
      {
        action: 'TREASURE',
        status: 'COMPLETED',
        delta: {
          type: 'TREASURE',
          detail: {
            rewards: {
              gold: 5,
              items: [
                {
                  quantity: 1,
                  code: 'ring-topaz',
                },
              ],
              buffs: [],
              unlocks: [],
            },
            progress: {
              previousProgress: 0,
              floorProgress: 10,
              delta: 10,
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
                  itemId: deterministicUuidV5('inventory:ring-topaz'),
                  code: 'ring-topaz',
                  slot: 'ring',
                  rarity: 'uncommon',
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
              source: 'TREASURE',
              drop: {
                tableId: 'drops-default',
                isElite: false,
                items: [
                  {
                    code: 'ring-topaz',
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
        delta: { type: 'REST', detail: { stats: { ap: -1 } } },
      },
      {
        action: 'REST',
        status: 'COMPLETED',
        delta: {
          type: 'REST',
          detail: {
            stats: { hp: 4 },
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
                base: { hp: 10, atk: 3, def: 1, luck: 1 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 10, atk: 3, def: 1, luck: 1 },
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
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -1, exp: 3 },
            rewards: {
              items: [{ code: 'ring-topaz', quantity: 1 }],
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
                base: { hp: 10, atk: 3, def: 1, luck: 1 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 10, atk: 3, def: 1, luck: 1 },
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
      {
        action: 'ACQUIRE_ITEM',
        status: 'COMPLETED',
        delta: {
          type: 'ACQUIRE_ITEM',
          detail: {
            inventory: {
              added: [
                {
                  itemId: deterministicUuidV5('inventory:ring-topaz'),
                  code: 'ring-topaz',
                  slot: 'ring',
                  rarity: 'uncommon',
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
                    code: 'ring-topaz',
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

export const baselineSnapshot = {
  seed: baselineSeed,
  initialState: baselineInitialState,
  results: baselineSteps,
};
