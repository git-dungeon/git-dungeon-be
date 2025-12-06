import type { CatalogMonster } from '../../catalog';

export type MonsterScalingOptions = {
  baseFloor?: number;
  floorScaleRate?: number; // per-floor increment (e.g., 0.01 -> +1%)
  eliteMultiplier?: number;
  roundFn?: (value: number) => number;
};

export type ScaledMonsterStats = {
  hp: number;
  atk: number;
  def: number;
  floor: number;
  rarityMultiplier: number;
  floorMultiplier: number;
};

const DEFAULT_SCALING_OPTIONS: Required<
  Pick<
    MonsterScalingOptions,
    'baseFloor' | 'floorScaleRate' | 'eliteMultiplier'
  >
> = {
  baseFloor: 1,
  floorScaleRate: 0.01,
  eliteMultiplier: 1.3,
};

const defaultRound: NonNullable<MonsterScalingOptions['roundFn']> = Math.round;

export const computeFloorMultiplier = (
  floor: number,
  baseFloor: number,
  floorScaleRate: number,
): number => {
  const normalizedFloor = Math.max(baseFloor, floor);
  const delta = normalizedFloor - baseFloor;
  return 1 + delta * floorScaleRate;
};

export const computeRarityMultiplier = (
  rarity: CatalogMonster['rarity'],
  eliteMultiplier: number,
): number => {
  return rarity === 'elite' ? eliteMultiplier : 1;
};

export const getScaledStats = (
  monster: CatalogMonster,
  floor: number,
  options: MonsterScalingOptions = {},
): ScaledMonsterStats => {
  const baseFloor = options.baseFloor ?? DEFAULT_SCALING_OPTIONS.baseFloor;
  const floorScaleRate =
    options.floorScaleRate ?? DEFAULT_SCALING_OPTIONS.floorScaleRate;
  const eliteMultiplier =
    options.eliteMultiplier ?? DEFAULT_SCALING_OPTIONS.eliteMultiplier;
  const roundFn = options.roundFn ?? defaultRound;

  const floorMultiplier = computeFloorMultiplier(
    floor,
    baseFloor,
    floorScaleRate,
  );
  const rarityMultiplier = computeRarityMultiplier(
    monster.rarity,
    eliteMultiplier,
  );
  const scale = (value: number): number =>
    roundFn(value * floorMultiplier * rarityMultiplier);

  return {
    hp: scale(monster.hp),
    atk: scale(monster.atk),
    def: scale(monster.def),
    floor: Math.max(baseFloor, floor),
    rarityMultiplier,
    floorMultiplier,
  };
};
