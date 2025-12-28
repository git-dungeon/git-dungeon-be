import type { StatsDelta } from '../logs/dungeon-log-delta';
import type { InventoryModifier } from '../inventory/inventory-modifier';

/**
 * 아이템 modifiers에서 flat 스탯 보너스를 추출합니다.
 * percent 모드는 제외 (순수 장비 스탯 차이만 계산)
 */
export function extractFlatStatModifiers(
  modifiers: InventoryModifier[],
): StatsDelta {
  const stats: StatsDelta = {};

  for (const modifier of modifiers) {
    if (modifier.kind === 'stat' && modifier.mode === 'flat') {
      const statKey = modifier.stat as keyof StatsDelta;
      stats[statKey] = (stats[statKey] ?? 0) + modifier.value;
    }
  }

  return stats;
}

/**
 * 두 스탯 delta의 차이를 계산합니다.
 * equip - unequip = 순 변화량
 */
export function calculateStatsDiff(
  equipStats: StatsDelta,
  unequipStats: StatsDelta,
): StatsDelta {
  const result: StatsDelta = {};
  const allKeys = new Set([
    ...Object.keys(equipStats),
    ...Object.keys(unequipStats),
  ]) as Set<keyof StatsDelta>;

  for (const key of allKeys) {
    const equipped = equipStats[key] ?? 0;
    const unequipped = unequipStats[key] ?? 0;
    const diff = equipped - unequipped;

    if (diff !== 0) {
      result[key] = diff;
    }
  }

  return result;
}

/**
 * StatsDelta가 비어있는지 확인합니다.
 */
export function isEmptyStatsDelta(stats: StatsDelta): boolean {
  return Object.keys(stats).length === 0;
}
