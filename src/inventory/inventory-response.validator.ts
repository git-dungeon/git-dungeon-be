import type { InventoryResponse } from './dto/inventory.response';
import {
  assertArray,
  assertBoolean,
  assertIsoDateTimeString,
  assertNullableString,
  assertNumber,
  assertRecord,
  assertString,
} from '../common/validation/runtime-validation';

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
  assertString(item.slot, `${path}.slot`, { minLength: 1 });
  assertString(item.rarity, `${path}.rarity`, { minLength: 1 });
  assertArray(item.modifiers, `${path}.modifiers`);
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
