import type { DungeonState } from '@prisma/client';

export const createState = (
  overrides: Partial<DungeonState> = {},
): DungeonState => ({
  userId: '00000000-0000-4000-8000-000000000201',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 1,
  luck: 1,
  levelUpPoints: 0,
  levelUpRollIndex: 0,
  equipmentBonus: null,
  statsVersion: 0,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 10,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  version: 1,
  ...overrides,
});
