import type { InventoryResponse } from './dto/inventory.response';
import {
  INVENTORY_MODES,
  INVENTORY_STATS,
} from '../common/inventory/inventory-modifier';
import {
  assertArray,
  assertBoolean,
  assertIsoDateTimeString,
  assertNullableString,
  assertNumber,
  assertOneOf,
  assertRecord,
  assertString,
} from '../common/validation/runtime-validation';
import { INVENTORY_RARITIES, INVENTORY_SLOTS } from './dto/inventory.response';

const assertEquipmentStats = (value: unknown, path: string): void => {
  const stats = assertRecord(value, path);
  assertNumber(stats.hp, `${path}.hp`, { integer: true });
  assertNumber(stats.maxHp, `${path}.maxHp`, { integer: true });
  assertNumber(stats.atk, `${path}.atk`, { integer: true });
  assertNumber(stats.def, `${path}.def`, { integer: true });
  assertNumber(stats.luck, `${path}.luck`, { integer: true });
};

const assertEquipmentItem = (value: unknown, path: string): void => {
  const item = assertRecord(value, path);
  assertString(item.id, `${path}.id`, { minLength: 1 });
  assertString(item.code, `${path}.code`, { minLength: 1 });
  assertNullableString(item.name ?? null, `${path}.name`);
  assertOneOf(item.slot, `${path}.slot`, INVENTORY_SLOTS);
  assertOneOf(item.rarity, `${path}.rarity`, INVENTORY_RARITIES);
  const modifiers = assertArray(item.modifiers, `${path}.modifiers`);
  modifiers.forEach((modifier, index) => {
    const entry = assertRecord(modifier, `${path}.modifiers[${index}]`);
    const kind = assertOneOf(entry.kind, `${path}.modifiers[${index}].kind`, [
      'stat',
      'effect',
    ] as const);
    if (kind === 'stat') {
      assertOneOf(
        entry.stat,
        `${path}.modifiers[${index}].stat`,
        INVENTORY_STATS,
      );
      assertOneOf(
        entry.mode ?? 'flat',
        `${path}.modifiers[${index}].mode`,
        INVENTORY_MODES,
      );
      assertNumber(entry.value, `${path}.modifiers[${index}].value`);
      return;
    }

    assertString(entry.effectCode, `${path}.modifiers[${index}].effectCode`, {
      minLength: 1,
    });
    if (entry.params !== undefined && entry.params !== null) {
      assertRecord(entry.params, `${path}.modifiers[${index}].params`);
    }
  });
  assertNullableString(item.effect ?? null, `${path}.effect`);
  assertNullableString(item.sprite ?? null, `${path}.sprite`);
  assertIsoDateTimeString(item.createdAt, `${path}.createdAt`);
  assertBoolean(item.isEquipped, `${path}.isEquipped`);
  assertNumber(item.quantity, `${path}.quantity`, { integer: true, min: 1 });
  assertNumber(item.enhancementLevel, `${path}.enhancementLevel`, {
    integer: true,
    min: 0,
  });
  assertNumber(item.version, `${path}.version`, { integer: true, min: 0 });
};

export const assertInventoryResponsePayload = (
  input: InventoryResponse,
): InventoryResponse => {
  const root = assertRecord(input, '$');
  assertNumber(root.version, '$.version', { integer: true, min: 0 });

  const items = assertArray(root.items, '$.items');
  items.forEach((item, index) => {
    assertEquipmentItem(item, `$.items[${index}]`);
  });

  const equipped = assertRecord(root.equipped, '$.equipped');
  Object.entries(equipped).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    assertEquipmentItem(value, `$.equipped.${key}`);
  });

  const summary = assertRecord(root.summary, '$.summary');
  assertEquipmentStats(summary.base, '$.summary.base');
  assertEquipmentStats(summary.total, '$.summary.total');
  assertEquipmentStats(summary.equipmentBonus, '$.summary.equipmentBonus');

  return input;
};
