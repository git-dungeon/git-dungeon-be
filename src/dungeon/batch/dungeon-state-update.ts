import type { DungeonState, Prisma } from '@prisma/client';

export const PERSISTED_DUNGEON_STATE_KEYS = [
  'level',
  'exp',
  'hp',
  'maxHp',
  'atk',
  'def',
  'luck',
  'levelUpPoints',
  'unopenedChests',
  'chestRollIndex',
  'floor',
  'maxFloor',
  'floorProgress',
  'gold',
  'ap',
  'currentAction',
  'currentActionStartedAt',
  'version',
] as const satisfies readonly (keyof DungeonState)[];

type PersistedKey = (typeof PERSISTED_DUNGEON_STATE_KEYS)[number];

export const buildDungeonStateUpdate = (
  state: DungeonState,
): Prisma.DungeonStateUpdateManyMutationInput => {
  const data = {} as Record<PersistedKey, DungeonState[PersistedKey]>;
  for (const key of PERSISTED_DUNGEON_STATE_KEYS) {
    data[key] = state[key];
  }
  return data as Prisma.DungeonStateUpdateManyMutationInput;
};
