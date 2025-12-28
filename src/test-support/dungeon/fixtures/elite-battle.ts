import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './fixture.types';
import { deterministicUuidV5 } from '../../../common/ids/deterministic-uuid';

/**
 * 엘리트 전투 + 멀티 드랍 시나리오
 * seed: elite15
 * 초기: hp20/20, atk8, def4, luck5, floor5, progress0, ap1, level5
 * 결과: Cave Spider (Elite) 승리, exp+10, progress +20, 드랍 2개(weapon-battle-axe, helmet-bronze-helm)
 */
export const eliteBattleSeed = 'elite15';

export const eliteBattleInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000106',
  level: 5,
  exp: 0,
  hp: 20,
  maxHp: 20,
  atk: 8,
  def: 4,
  luck: 5,
  floor: 5,
  maxFloor: 5,
  floorProgress: 0,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const eliteBattleSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 19,
      ap: 0,
      floor: 5,
      floorProgress: 20,
      level: 5,
      exp: 10,
      version: 2,
    },
    extra: [
      {
        action: 'BATTLE',
        status: 'STARTED',
        category: 'EXPLORATION',
        floor: 5,
        turnNumber: 0,
        delta: { type: 'BATTLE', detail: { stats: { ap: -1 } } },
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              code: 'monster-cave-spider-elite',
              name: 'Cave Spider (Elite)',
              hp: 14,
              atk: 5,
              def: 1,
              spriteId: 'sprite/monster-cave-spider',
            },
            player: {
              hp: 20,
              maxHp: 20,
              atk: 8,
              def: 4,
              luck: 5,
              stats: {
                base: { hp: 20, atk: 8, def: 4, luck: 5 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 20, atk: 8, def: 4, luck: 5 },
              },
              level: 5,
              exp: 0,
              expToLevel: 50,
            },
          },
        },
      },
      {
        action: 'BATTLE',
        status: 'COMPLETED',
        category: 'EXPLORATION',
        floor: 5,
        turnNumber: 0,
        delta: {
          type: 'BATTLE',
          detail: {
            stats: { hp: -1, exp: 10 },
            rewards: {
              items: [
                { code: 'weapon-battle-axe', quantity: 1 },
                { code: 'helmet-bronze-helm', quantity: 1 },
              ],
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
              code: 'monster-cave-spider-elite',
              name: 'Cave Spider (Elite)',
              hp: 14,
              atk: 5,
              def: 1,
              spriteId: 'sprite/monster-cave-spider',
            },
            player: {
              hp: 19,
              maxHp: 20,
              atk: 8,
              def: 4,
              luck: 5,
              stats: {
                base: { hp: 20, atk: 8, def: 4, luck: 5 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 20, atk: 8, def: 4, luck: 5 },
              },
              level: 5,
              exp: 10,
              expToLevel: 50,
            },
            result: 'VICTORY',
            expGained: 10,
            turns: 2,
            damageDealt: 15,
            damageTaken: 1,
          },
        },
      },
      {
        action: 'ACQUIRE_ITEM',
        status: 'COMPLETED',
        category: 'STATUS',
        floor: 5,
        turnNumber: 0,
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
                {
                  itemId: deterministicUuidV5('inventory:helmet-bronze-helm'),
                  code: 'helmet-bronze-helm',
                  slot: 'helmet',
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
                isElite: true,
                items: [
                  { code: 'weapon-battle-axe', quantity: 1 },
                  { code: 'helmet-bronze-helm', quantity: 1 },
                ],
              },
            },
          },
        },
      },
    ],
  },
];

export const eliteBattleSnapshot = {
  seed: eliteBattleSeed,
  initialState: eliteBattleInitialState,
  results: eliteBattleSteps,
};
