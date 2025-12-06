import type { DungeonState } from '@prisma/client';
import type { EffectDelta } from './event.types';
import type { StatsDelta } from '../../common/logs/dungeon-log-delta';

type ApplyEffectResult = {
  state: DungeonState;
  statsDelta: StatsDelta;
  rewardsDelta: {
    gold?: number;
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const applyEffectDelta = (
  state: DungeonState,
  effect: EffectDelta,
): ApplyEffectResult => {
  const stats: StatsDelta = {};
  const rewards: ApplyEffectResult['rewardsDelta'] = {};
  let nextState = { ...state };

  if (effect.stats?.hp !== undefined || effect.scaling?.hpRatio !== undefined) {
    const flat = effect.stats?.hp ?? 0;
    const ratio = effect.scaling?.hpRatio ?? 0;
    const delta = flat + Math.floor(state.maxHp * ratio);
    const nextHp = clamp(state.hp + delta, 0, state.maxHp);
    stats.hp = nextHp - state.hp;
    nextState = { ...nextState, hp: nextHp };
  }

  if (effect.stats?.ap !== undefined) {
    const nextAp = Math.max(0, state.ap + effect.stats.ap);
    stats.ap = nextAp - state.ap;
    nextState = { ...nextState, ap: nextAp };
  }

  if (effect.stats?.atk !== undefined) {
    const nextAtk = Math.max(0, state.atk + effect.stats.atk);
    stats.atk = nextAtk - state.atk;
    nextState = { ...nextState, atk: nextAtk };
  }

  if (effect.stats?.def !== undefined) {
    const nextDef = Math.max(0, state.def + effect.stats.def);
    stats.def = nextDef - state.def;
    nextState = { ...nextState, def: nextDef };
  }

  if (effect.stats?.luck !== undefined) {
    const nextLuck = Math.max(0, state.luck + effect.stats.luck);
    stats.luck = nextLuck - state.luck;
    nextState = { ...nextState, luck: nextLuck };
  }

  if (effect.rewards?.gold !== undefined) {
    const newGold = Math.max(0, state.gold + effect.rewards.gold);
    rewards.gold = newGold - state.gold;
    nextState = { ...nextState, gold: newGold };
  }

  return {
    state: nextState,
    statsDelta: stats,
    rewardsDelta: rewards,
  };
};
