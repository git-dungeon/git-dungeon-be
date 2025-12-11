import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_EVENT_WEIGHTS, type EffectDelta } from '../event.types';

export type EventWeightsConfig = {
  BATTLE: number;
  TREASURE: number;
  REST: number;
  TRAP: number;
};

export type BattleConfig = {
  eliteRate: number;
  critBase: number;
  critLuckFactor: number;
  turnLimit: number;
  exp: {
    eliteBonus: number;
  };
};

export type EventConfig = {
  weights: EventWeightsConfig;
  battle: BattleConfig;
  effects: Partial<Record<string, EffectDelta>>;
};

export const loadEventConfig = (): EventConfig => {
  const filePath = join(__dirname, 'event-config.json');
  let parsed: unknown = {};

  try {
    const json = readFileSync(filePath, 'utf-8');
    parsed = JSON.parse(json);
  } catch (_error) {
    // fallback to defaults if config file is missing or invalid JSON
    parsed = {
      weights: DEFAULT_EVENT_WEIGHTS,
      battle: defaultBattleConfig(),
      effects: {},
    };
  }

  return validateEventConfig(parsed);
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const validateEventConfig = (config: unknown): EventConfig => {
  if (!config || typeof config !== 'object' || !('weights' in config)) {
    throw new Error('Invalid event config structure');
  }

  const weights = (config as EventConfig).weights;
  const effects = (config as EventConfig).effects ?? {};
  const battle = validateBattleConfig(
    (config as EventConfig).battle ?? defaultBattleConfig(),
  );

  if (
    !isNumber(weights.BATTLE) ||
    !isNumber(weights.TREASURE) ||
    !isNumber(weights.REST) ||
    !isNumber(weights.TRAP)
  ) {
    throw new Error('Invalid weights in event config');
  }

  Object.values(effects ?? {}).forEach((effect) => validateEffect(effect));

  return {
    weights,
    battle,
    effects,
  };
};

const validateEffect = (effect: EffectDelta | undefined) => {
  if (!effect) return;
  if (effect.stats) {
    Object.values(effect.stats).forEach((value) => {
      if (!isNumber(value)) {
        throw new Error('Invalid stats in event effect');
      }
    });
  }
  if (effect.rewards?.gold !== undefined && !isNumber(effect.rewards.gold)) {
    throw new Error('Invalid rewards.gold in event effect');
  }
};

const defaultBattleConfig = (): BattleConfig => ({
  eliteRate: 0.05,
  critBase: 0.05,
  critLuckFactor: 0.01,
  turnLimit: 30,
  exp: {
    eliteBonus: 1.5,
  },
});

const validateBattleConfig = (battle: BattleConfig): BattleConfig => {
  const cfg = {
    ...defaultBattleConfig(),
    ...battle,
    exp: { ...defaultBattleConfig().exp, ...(battle?.exp ?? {}) },
  };

  if (
    !isNumber(cfg.eliteRate) ||
    !isNumber(cfg.critBase) ||
    !isNumber(cfg.critLuckFactor) ||
    !isNumber(cfg.turnLimit) ||
    !isNumber(cfg.exp.eliteBonus)
  ) {
    throw new Error('Invalid battle config');
  }

  return cfg;
};
