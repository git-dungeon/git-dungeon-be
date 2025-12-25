import type { DungeonState } from '@prisma/client';
import type { SnapshotStep } from './baseline';

/**
 * 운영 설정(turnLimit=30) 기반 turn-limit 패배
 * seed: tlprod1
 * 초기: level30, hp150/150, atk2, def60, floor120, progress0, ap1
 * 결과: Ancient Dragon과 30턴 후 TURN_LIMIT 패배, hp 116, progress +20
 */
export const turnLimitSeed = 'tlprod1';

export const turnLimitInitialState: DungeonState = {
  userId: '00000000-0000-4000-8000-000000000104',
  level: 30,
  exp: 0,
  hp: 150,
  maxHp: 150,
  atk: 2,
  def: 60,
  luck: 0,
  floor: 120,
  maxFloor: 120,
  floorProgress: 0,
  gold: 0,
  ap: 1,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  version: 1,
};

export const turnLimitSteps: SnapshotStep[] = [
  {
    actionCounter: 0,
    selectedEvent: 'BATTLE',
    stateAfter: {
      hp: 116,
      ap: 0,
      floor: 120,
      floorProgress: 20,
      level: 30,
      exp: 0,
      version: 2,
    },
    extra: [
      {
        action: 'BATTLE',
        status: 'STARTED',
        extra: {
          type: 'BATTLE',
          details: {
            monster: {
              code: 'monster-ancient-dragon',
              name: 'Ancient Dragon',
              hp: 110,
              atk: 22,
              def: 11,
              spriteId: 'sprite/monster-ancient-dragon',
            },
            player: {
              hp: 150,
              maxHp: 150,
              atk: 2,
              def: 60,
              luck: 0,
              stats: {
                base: { hp: 150, atk: 2, def: 60, luck: 0 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 150, atk: 2, def: 60, luck: 0 },
              },
              level: 30,
              exp: 0,
              expToLevel: 300,
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
            stats: { hp: -34 },
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
              hp: 110,
              atk: 22,
              def: 11,
              spriteId: 'sprite/monster-ancient-dragon',
            },
            player: {
              hp: 116,
              maxHp: 150,
              atk: 2,
              def: 60,
              luck: 0,
              stats: {
                base: { hp: 150, atk: 2, def: 60, luck: 0 },
                equipmentBonus: { hp: 0, atk: 0, def: 0, luck: 0 },
                total: { hp: 150, atk: 2, def: 60, luck: 0 },
              },
              level: 30,
              exp: 0,
              expToLevel: 300,
            },
            result: 'DEFEAT',
            cause: 'TURN_LIMIT',
            expGained: 0,
            turns: 30,
            damageDealt: 33,
            damageTaken: 34,
          },
        },
      },
    ],
  },
];

export const turnLimitSnapshot = {
  seed: turnLimitSeed,
  initialState: turnLimitInitialState,
  results: turnLimitSteps,
};
