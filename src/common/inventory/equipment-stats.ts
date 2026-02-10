import type { EquipmentStats } from '../../inventory/dto/inventory-response.dto';
import { INVENTORY_STATS, type InventoryModifier } from './inventory-modifier';

export const createEmptyEquipmentStats = (): EquipmentStats => ({
  hp: 0,
  maxHp: 0,
  atk: 0,
  def: 0,
  luck: 0,
});

export const addEquipmentStats = (
  base: EquipmentStats,
  bonus: EquipmentStats,
): EquipmentStats => ({
  hp: base.hp + bonus.hp,
  maxHp: base.maxHp + bonus.maxHp,
  atk: base.atk + bonus.atk,
  def: base.def + bonus.def,
  luck: base.luck + bonus.luck,
});

export const calculateEquipmentBonus = (
  baseStats: EquipmentStats,
  modifiersList: InventoryModifier[][],
): EquipmentStats => {
  const flat = createEmptyEquipmentStats();
  const percent = createEmptyEquipmentStats();

  modifiersList.forEach((modifiers) => {
    modifiers.forEach((modifier) => {
      if (modifier.kind !== 'stat') {
        return;
      }

      if (modifier.mode === 'percent') {
        percent[modifier.stat] += modifier.value;
        return;
      }

      flat[modifier.stat] += modifier.value;
    });
  });

  const bonus = createEmptyEquipmentStats();
  INVENTORY_STATS.forEach((stat) => {
    const flatValue = flat[stat];
    const percentValue = percent[stat];
    const base = baseStats[stat];

    bonus[stat] = flatValue + Math.floor((base + flatValue) * percentValue);
  });

  bonus.maxHp = bonus.hp;

  return bonus;
};

export const calculateEnhancementBonus = (
  items: Array<{ slot: string; enhancementLevel?: number | null }>,
): EquipmentStats => {
  const bonus = createEmptyEquipmentStats();

  for (const item of items) {
    const level = item.enhancementLevel ?? 0;
    if (level <= 0) {
      continue;
    }

    switch (item.slot.toUpperCase()) {
      case 'WEAPON':
        bonus.atk += level;
        break;
      case 'ARMOR':
      case 'HELMET':
        bonus.def += level;
        break;
      case 'RING':
        bonus.luck += level;
        break;
      default:
        break;
    }
  }

  return bonus;
};
