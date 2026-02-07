import type { DashboardStateResponse } from './dto/dashboard-state.response';
import {
  assertArray,
  assertBoolean,
  assertIsoDateTimeString,
  assertNullableIsoDateTimeString,
  assertNullableNumber,
  assertNullableString,
  assertNumber,
  assertRecord,
  assertString,
} from '../common/validation/runtime-validation';

const assertStatBlock = (value: unknown, path: string): void => {
  const block = assertRecord(value, path);
  assertNumber(block.hp, `${path}.hp`);
  assertNumber(block.maxHp, `${path}.maxHp`);
  assertNumber(block.atk, `${path}.atk`);
  assertNumber(block.def, `${path}.def`);
  assertNumber(block.luck, `${path}.luck`);
};

const assertEquipmentItem = (value: unknown, path: string): void => {
  const item = assertRecord(value, path);
  assertString(item.id, `${path}.id`, { minLength: 1 });
  assertString(item.code, `${path}.code`, { minLength: 1 });
  assertString(item.slot, `${path}.slot`, { minLength: 1 });
  assertString(item.rarity, `${path}.rarity`, { minLength: 1 });
  assertArray(item.modifiers, `${path}.modifiers`);
  assertNullableString(item.name ?? null, `${path}.name`);
  assertNullableString(item.effect ?? null, `${path}.effect`);
  assertNullableString(item.sprite ?? null, `${path}.sprite`);
  assertIsoDateTimeString(item.createdAt, `${path}.createdAt`);
  assertBoolean(item.isEquipped, `${path}.isEquipped`);
  assertNumber(item.version, `${path}.version`, { integer: true, min: 0 });
};

export const assertDashboardStateResponse = (
  input: DashboardStateResponse,
): DashboardStateResponse => {
  const root = assertRecord(input, '$');
  const state = assertRecord(root.state, '$.state');

  assertString(state.userId, '$.state.userId', { minLength: 1 });
  assertNumber(state.level, '$.state.level', { integer: true });
  assertNumber(state.exp, '$.state.exp', { integer: true });
  assertNumber(state.levelUpPoints, '$.state.levelUpPoints', {
    integer: true,
    min: 0,
  });
  assertNumber(state.unopenedChests, '$.state.unopenedChests', {
    integer: true,
    min: 0,
  });
  assertNumber(state.hp, '$.state.hp', { integer: true, min: 0 });
  assertNumber(state.maxHp, '$.state.maxHp', { integer: true, min: 0 });
  assertNumber(state.atk, '$.state.atk', { integer: true });
  assertNumber(state.def, '$.state.def', { integer: true });
  assertNumber(state.luck, '$.state.luck', { integer: true });
  assertNumber(state.floor, '$.state.floor', { integer: true, min: 0 });
  assertNumber(state.maxFloor, '$.state.maxFloor', { integer: true, min: 0 });
  assertNumber(state.floorProgress, '$.state.floorProgress', {
    min: 0,
    max: 100,
  });
  assertNumber(state.gold, '$.state.gold', { integer: true });
  assertNumber(state.ap, '$.state.ap', { integer: true, min: 0 });
  assertNullableString(state.currentAction ?? null, '$.state.currentAction');
  assertNullableIsoDateTimeString(
    state.currentActionStartedAt ?? null,
    '$.state.currentActionStartedAt',
  );
  assertIsoDateTimeString(state.createdAt, '$.state.createdAt');
  assertNumber(state.version, '$.state.version', { integer: true, min: 0 });
  assertIsoDateTimeString(state.updatedAt, '$.state.updatedAt');
  assertNullableNumber(state.expToLevel, '$.state.expToLevel', {
    integer: true,
    min: 1,
  });

  const stats = assertRecord(state.stats, '$.state.stats');
  assertStatBlock(stats.base, '$.state.stats.base');
  assertStatBlock(stats.equipmentBonus, '$.state.stats.equipmentBonus');
  assertStatBlock(stats.total, '$.state.stats.total');

  const equippedItems = assertArray(
    state.equippedItems,
    '$.state.equippedItems',
  );
  equippedItems.forEach((item, index) => {
    assertEquipmentItem(item, `$.state.equippedItems[${index}]`);
  });

  return input;
};
