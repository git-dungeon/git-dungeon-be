import type {
  EmbeddingPreviewLanguage,
  EmbeddingPreviewPayload,
  EmbeddingPreviewRarity,
  EmbeddingPreviewSize,
  EmbeddingPreviewSlot,
  EmbeddingPreviewStat,
  EmbeddingPreviewTheme,
} from './dto/embedding-preview.response';
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

const PREVIEW_THEME = [
  'light',
  'dark',
] as const satisfies readonly EmbeddingPreviewTheme[];
const PREVIEW_SIZE = [
  'compact',
  'wide',
] as const satisfies readonly EmbeddingPreviewSize[];
const PREVIEW_LANGUAGE = [
  'ko',
  'en',
] as const satisfies readonly EmbeddingPreviewLanguage[];
const PREVIEW_SLOT = [
  'helmet',
  'armor',
  'weapon',
  'ring',
] as const satisfies readonly EmbeddingPreviewSlot[];
const PREVIEW_RARITY = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const satisfies readonly EmbeddingPreviewRarity[];
const PREVIEW_STAT = [
  'hp',
  'maxHp',
  'atk',
  'def',
  'luck',
  'ap',
] as const satisfies readonly EmbeddingPreviewStat[];

const assertStatBlock = (value: unknown, path: string): void => {
  const stats = assertRecord(value, path);
  assertNumber(stats.hp, `${path}.hp`, { integer: true });
  assertNumber(stats.maxHp, `${path}.maxHp`, { integer: true });
  assertNumber(stats.atk, `${path}.atk`, { integer: true });
  assertNumber(stats.def, `${path}.def`, { integer: true });
  assertNumber(stats.luck, `${path}.luck`, { integer: true });
  assertNumber(stats.ap, `${path}.ap`, { integer: true });
};

const assertEquipmentItem = (value: unknown, path: string): void => {
  const item = assertRecord(value, path);
  assertString(item.id, `${path}.id`, { minLength: 1 });
  assertNullableString(item.code, `${path}.code`);
  assertString(item.name, `${path}.name`, { minLength: 1 });
  assertOneOf(item.slot, `${path}.slot`, PREVIEW_SLOT);
  assertOneOf(item.rarity, `${path}.rarity`, PREVIEW_RARITY);

  const modifiers = assertArray(item.modifiers, `${path}.modifiers`);
  modifiers.forEach((modifier, index) => {
    const mod = assertRecord(modifier, `${path}.modifiers[${index}]`);
    assertOneOf(mod.stat, `${path}.modifiers[${index}].stat`, PREVIEW_STAT);
    assertNumber(mod.value, `${path}.modifiers[${index}].value`);
  });

  if (item.effect === null) {
    // noop
  } else {
    const effect = assertRecord(item.effect, `${path}.effect`);
    assertString(effect.type, `${path}.effect.type`, { minLength: 1 });
    assertString(effect.description, `${path}.effect.description`, {
      minLength: 1,
    });
  }

  assertString(item.sprite, `${path}.sprite`, { minLength: 1 });
  assertIsoDateTimeString(item.createdAt, `${path}.createdAt`);
  assertBoolean(item.isEquipped, `${path}.isEquipped`);
};

export const assertEmbeddingPreviewPayload = (
  input: EmbeddingPreviewPayload,
): EmbeddingPreviewPayload => {
  const root = assertRecord(input, '$');
  assertOneOf(root.theme, '$.theme', PREVIEW_THEME);
  assertOneOf(root.size, '$.size', PREVIEW_SIZE);
  assertOneOf(root.language, '$.language', PREVIEW_LANGUAGE);
  assertIsoDateTimeString(root.generatedAt, '$.generatedAt');

  const overview = assertRecord(root.overview, '$.overview');
  assertNullableString(overview.displayName, '$.overview.displayName');
  assertNullableString(overview.avatarUrl, '$.overview.avatarUrl');
  assertNumber(overview.level, '$.overview.level', { integer: true, min: 0 });
  assertNumber(overview.exp, '$.overview.exp', { integer: true, min: 0 });
  assertNumber(overview.expToLevel, '$.overview.expToLevel', {
    integer: true,
    min: 0,
  });
  assertNumber(overview.gold, '$.overview.gold', { integer: true });
  assertNumber(overview.ap, '$.overview.ap', { integer: true, min: 0 });
  if (overview.maxAp === null) {
    // noop
  } else {
    assertNumber(overview.maxAp, '$.overview.maxAp', { integer: true, min: 0 });
  }

  const floor = assertRecord(overview.floor, '$.overview.floor');
  assertNumber(floor.current, '$.overview.floor.current', {
    integer: true,
    min: 0,
  });
  assertNumber(floor.best, '$.overview.floor.best', { integer: true, min: 0 });
  assertNumber(floor.progress, '$.overview.floor.progress', {
    min: 0,
    max: 100,
  });

  const stats = assertRecord(overview.stats, '$.overview.stats');
  assertStatBlock(stats.total, '$.overview.stats.total');
  assertStatBlock(stats.base, '$.overview.stats.base');
  assertStatBlock(stats.equipmentBonus, '$.overview.stats.equipmentBonus');

  const equipment = assertArray(overview.equipment, '$.overview.equipment');
  equipment.forEach((item, index) => {
    assertEquipmentItem(item, `$.overview.equipment[${index}]`);
  });

  return input;
};
