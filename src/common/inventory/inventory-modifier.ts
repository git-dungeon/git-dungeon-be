export const INVENTORY_STATS = ['hp', 'atk', 'def', 'luck'] as const;
export type InventoryStat = (typeof INVENTORY_STATS)[number];

export const INVENTORY_MODES = ['flat', 'percent'] as const;
export type InventoryModifierMode = (typeof INVENTORY_MODES)[number];

export interface InventoryStatModifier {
  kind: 'stat';
  stat: InventoryStat;
  mode: InventoryModifierMode;
  value: number;
}

export interface InventoryEffectModifier {
  kind: 'effect';
  effectCode: string;
  params?: Record<string, unknown>;
}

export type InventoryModifier = InventoryStatModifier | InventoryEffectModifier;

export const normalizeInventoryModifier = (
  modifier: InventoryModifier,
): InventoryModifier => {
  if (modifier.kind === 'stat') {
    return {
      ...modifier,
      mode: modifier.mode ?? 'flat',
    };
  }

  return modifier;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

export const parseInventoryModifiers = (
  modifiers: unknown,
): InventoryModifier[] => {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers
    .filter((modifier): modifier is InventoryModifier => {
      if (!isPlainObject(modifier) || !('kind' in modifier)) {
        return false;
      }

      if (modifier.kind === 'stat') {
        return 'stat' in modifier && 'value' in modifier;
      }

      if (modifier.kind === 'effect') {
        return 'effectCode' in modifier;
      }

      return false;
    })
    .map((modifier) => normalizeInventoryModifier(modifier));
};
