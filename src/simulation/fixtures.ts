import {
  baselineSnapshot,
  trapDeathSnapshot,
  forcedMoveSnapshot,
  noDropSnapshot,
  longBattleSnapshot,
  turnLimitSnapshot,
  eliteBattleSnapshot,
  restClampSnapshot,
  levelUpSnapshot,
} from '../test-support/dungeon/fixtures';
import type { SimulationSnapshot } from './types';

export const fixtures: Record<string, SimulationSnapshot> = {
  baseline: baselineSnapshot,
  'trap-death': trapDeathSnapshot,
  'forced-move': forcedMoveSnapshot,
  'no-drop': noDropSnapshot,
  'long-battle': longBattleSnapshot,
  'turn-limit': turnLimitSnapshot,
  'elite-battle': eliteBattleSnapshot,
  'rest-clamp': restClampSnapshot,
  'level-up': levelUpSnapshot,
};

export const listFixtureNames = (): string[] =>
  Object.keys(fixtures).sort((a, b) => a.localeCompare(b));

export const getFixture = (
  name: string | undefined,
): SimulationSnapshot | undefined => {
  if (!name) return undefined;
  return fixtures[name];
};
