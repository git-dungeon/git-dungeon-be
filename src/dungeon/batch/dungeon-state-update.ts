import type { DungeonState, Prisma } from '@prisma/client';

export const buildDungeonStateUpdate = (
  state: DungeonState,
): Prisma.DungeonStateUpdateManyMutationInput => ({
  level: state.level,
  exp: state.exp,
  hp: state.hp,
  maxHp: state.maxHp,
  atk: state.atk,
  def: state.def,
  luck: state.luck,
  levelUpPoints: state.levelUpPoints,
  unopenedChests: state.unopenedChests,
  chestRollIndex: state.chestRollIndex,
  floor: state.floor,
  maxFloor: state.maxFloor,
  floorProgress: state.floorProgress,
  gold: state.gold,
  ap: state.ap,
  currentAction: state.currentAction,
  currentActionStartedAt: state.currentActionStartedAt,
  version: state.version,
});
