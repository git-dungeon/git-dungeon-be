import {
  INVENTORY_MODES,
  INVENTORY_STATS,
  type InventoryModifier,
} from '../common/inventory/inventory-modifier';
import {
  INVENTORY_SLOTS,
  type InventorySlot,
} from '../inventory/dto/inventory-response.dto';
import {
  RuntimeValidationError,
  assertArray,
  assertIsoDateTimeString,
  assertNumber,
  assertOneOf,
  assertRecord,
  assertString,
} from '../common/validation/runtime-validation';

export const CATALOG_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;
export type CatalogRarity = (typeof CATALOG_RARITIES)[number];

export const CATALOG_MONSTER_RARITIES = ['normal', 'elite'] as const;
export type CatalogMonsterRarity = (typeof CATALOG_MONSTER_RARITIES)[number];

export const ENHANCEMENT_SLOTS = ['helmet', 'armor', 'weapon', 'ring'] as const;
export type EnhancementSlot = (typeof ENHANCEMENT_SLOTS)[number];

export interface CatalogItem {
  code: string;
  nameKey: string;
  descriptionKey?: string | null;
  name: string;
  slot: InventorySlot;
  rarity: CatalogRarity;
  modifiers: InventoryModifier[];
  effectCode?: string | null;
  spriteId: string;
  description?: string | null;
}

export interface CatalogBuff {
  buffId: string;
  nameKey: string;
  descriptionKey?: string | null;
  name: string;
  effectCode: string;
  durationTurns?: number | null;
  maxStacks?: number | null;
  spriteId?: string | null;
  description?: string | null;
}

export interface CatalogMonster {
  code: string;
  nameKey: string;
  descriptionKey?: string | null;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spriteId: string;
  dropTableId?: string | null;
  description?: string | null;
  rarity: CatalogMonsterRarity;
  variantOf?: string | null;
}

export interface CatalogDrop {
  code: string;
  weight: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface CatalogDropTable {
  tableId: string;
  drops: CatalogDrop[];
}

export interface CatalogEnhancementConfig {
  maxLevel: number;
  successRates: Record<string, number>;
  goldCosts: Record<string, number>;
  materialCounts: Record<string, number>;
  materialsBySlot: Record<EnhancementSlot, string>;
}

export interface CatalogDismantleConfig {
  baseMaterialQuantityByRarity: Record<CatalogRarity, number>;
  refundByEnhancementLevel: Record<string, number>;
}

export interface CatalogData {
  version: number;
  updatedAt: string;
  items: CatalogItem[];
  buffs: CatalogBuff[];
  monsters: CatalogMonster[];
  dropTables: CatalogDropTable[];
  enhancement: CatalogEnhancementConfig;
  dismantle: CatalogDismantleConfig;
  assetsBaseUrl?: string | null;
  spriteMap?: Record<string, string> | null;
}

export interface CatalogValidationIssue {
  path: string;
  expected: string;
  value: unknown;
}

export type CatalogValidationResult =
  | {
      success: true;
      data: CatalogData;
      errors: [];
    }
  | {
      success: false;
      data: undefined;
      errors: CatalogValidationIssue[];
    };

const assertNumberRecord = (value: unknown, path: string): void => {
  const record = assertRecord(value, path);
  Object.entries(record).forEach(([key, entry]) => {
    assertNumber(entry, `${path}.${key}`);
  });
};

const assertStringRecord = (value: unknown, path: string): void => {
  const record = assertRecord(value, path);
  Object.entries(record).forEach(([key, entry]) => {
    assertString(entry, `${path}.${key}`, { minLength: 1 });
  });
};

const assertOptionalNullableString = (value: unknown, path: string): void => {
  if (value === undefined || value === null) {
    return;
  }
  assertString(value, path, { minLength: 1 });
};

const CATALOG_MODIFIER_KINDS = ['stat', 'effect'] as const;

const assertCatalogModifier = (value: unknown, path: string): void => {
  const modifier = assertRecord(value, path);
  const kind = assertOneOf(
    modifier.kind,
    `${path}.kind`,
    CATALOG_MODIFIER_KINDS,
  );

  if (kind === 'stat') {
    assertOneOf(modifier.stat, `${path}.stat`, INVENTORY_STATS);
    assertOneOf(modifier.mode ?? 'flat', `${path}.mode`, INVENTORY_MODES);
    assertNumber(modifier.value, `${path}.value`);
    return;
  }

  assertString(modifier.effectCode, `${path}.effectCode`, { minLength: 1 });
  if (modifier.params !== undefined && modifier.params !== null) {
    assertRecord(modifier.params, `${path}.params`);
  }
};

const assertCatalogDataShape = (input: unknown): CatalogData => {
  const root = assertRecord(input, '$');

  assertNumber(root.version, '$.version', { integer: true, min: 0 });
  assertIsoDateTimeString(root.updatedAt, '$.updatedAt');

  const items = assertArray(root.items, '$.items');
  items.forEach((item, index) => {
    const entry = assertRecord(item, `$.items[${index}]`);
    assertString(entry.code, `$.items[${index}].code`, { minLength: 1 });
    assertString(entry.nameKey, `$.items[${index}].nameKey`, { minLength: 1 });
    assertString(entry.name, `$.items[${index}].name`, { minLength: 1 });
    assertOneOf(entry.slot, `$.items[${index}].slot`, INVENTORY_SLOTS);
    assertOneOf(entry.rarity, `$.items[${index}].rarity`, CATALOG_RARITIES);
    const modifiers = assertArray(
      entry.modifiers,
      `$.items[${index}].modifiers`,
    );
    modifiers.forEach((modifier, modifierIndex) => {
      assertCatalogModifier(
        modifier,
        `$.items[${index}].modifiers[${modifierIndex}]`,
      );
    });
    assertOptionalNullableString(
      entry.descriptionKey,
      `$.items[${index}].descriptionKey`,
    );
    assertOptionalNullableString(
      entry.effectCode,
      `$.items[${index}].effectCode`,
    );
    assertString(entry.spriteId, `$.items[${index}].spriteId`, {
      minLength: 1,
    });
    assertOptionalNullableString(
      entry.description,
      `$.items[${index}].description`,
    );
  });

  const buffs = assertArray(root.buffs, '$.buffs');
  buffs.forEach((buff, index) => {
    const entry = assertRecord(buff, `$.buffs[${index}]`);
    assertString(entry.buffId, `$.buffs[${index}].buffId`, { minLength: 1 });
    assertString(entry.nameKey, `$.buffs[${index}].nameKey`, { minLength: 1 });
    assertString(entry.name, `$.buffs[${index}].name`, { minLength: 1 });
    assertString(entry.effectCode, `$.buffs[${index}].effectCode`, {
      minLength: 1,
    });
    assertOptionalNullableString(
      entry.descriptionKey,
      `$.buffs[${index}].descriptionKey`,
    );
    if (entry.durationTurns !== undefined && entry.durationTurns !== null) {
      assertNumber(entry.durationTurns, `$.buffs[${index}].durationTurns`, {
        integer: true,
        min: 1,
      });
    }
    if (entry.maxStacks !== undefined && entry.maxStacks !== null) {
      assertNumber(entry.maxStacks, `$.buffs[${index}].maxStacks`, {
        integer: true,
        min: 1,
      });
    }
    assertOptionalNullableString(entry.spriteId, `$.buffs[${index}].spriteId`);
    assertOptionalNullableString(
      entry.description,
      `$.buffs[${index}].description`,
    );
  });

  const monsters = assertArray(root.monsters, '$.monsters');
  monsters.forEach((monster, index) => {
    const entry = assertRecord(monster, `$.monsters[${index}]`);
    assertString(entry.code, `$.monsters[${index}].code`, { minLength: 1 });
    assertString(entry.nameKey, `$.monsters[${index}].nameKey`, {
      minLength: 1,
    });
    assertString(entry.name, `$.monsters[${index}].name`, { minLength: 1 });
    assertOptionalNullableString(
      entry.descriptionKey,
      `$.monsters[${index}].descriptionKey`,
    );
    assertNumber(entry.hp, `$.monsters[${index}].hp`, {
      integer: true,
      min: 1,
    });
    assertNumber(entry.atk, `$.monsters[${index}].atk`, {
      integer: true,
      min: 0,
    });
    assertNumber(entry.def, `$.monsters[${index}].def`, {
      integer: true,
      min: 0,
    });
    assertString(entry.spriteId, `$.monsters[${index}].spriteId`, {
      minLength: 1,
    });
    assertOneOf(
      entry.rarity,
      `$.monsters[${index}].rarity`,
      CATALOG_MONSTER_RARITIES,
    );
    assertOptionalNullableString(
      entry.dropTableId,
      `$.monsters[${index}].dropTableId`,
    );
    assertOptionalNullableString(
      entry.description,
      `$.monsters[${index}].description`,
    );
    assertOptionalNullableString(
      entry.variantOf,
      `$.monsters[${index}].variantOf`,
    );
  });

  const dropTables = assertArray(root.dropTables, '$.dropTables');
  dropTables.forEach((dropTable, tableIndex) => {
    const entry = assertRecord(dropTable, `$.dropTables[${tableIndex}]`);
    assertString(entry.tableId, `$.dropTables[${tableIndex}].tableId`, {
      minLength: 1,
    });
    const drops = assertArray(entry.drops, `$.dropTables[${tableIndex}].drops`);
    drops.forEach((drop, dropIndex) => {
      const dropEntry = assertRecord(
        drop,
        `$.dropTables[${tableIndex}].drops[${dropIndex}]`,
      );
      assertString(
        dropEntry.code,
        `$.dropTables[${tableIndex}].drops[${dropIndex}].code`,
        { minLength: 1 },
      );
      assertNumber(
        dropEntry.weight,
        `$.dropTables[${tableIndex}].drops[${dropIndex}].weight`,
        { min: 0 },
      );
      if (dropEntry.minQuantity !== undefined) {
        assertNumber(
          dropEntry.minQuantity,
          `$.dropTables[${tableIndex}].drops[${dropIndex}].minQuantity`,
          { integer: true, min: 1 },
        );
      }
      if (dropEntry.maxQuantity !== undefined) {
        assertNumber(
          dropEntry.maxQuantity,
          `$.dropTables[${tableIndex}].drops[${dropIndex}].maxQuantity`,
          { integer: true, min: 1 },
        );
      }
      if (
        typeof dropEntry.minQuantity === 'number' &&
        typeof dropEntry.maxQuantity === 'number' &&
        dropEntry.minQuantity > dropEntry.maxQuantity
      ) {
        throw new RuntimeValidationError(
          `$.dropTables[${tableIndex}].drops[${dropIndex}]`,
          'minQuantity <= maxQuantity',
          {
            minQuantity: dropEntry.minQuantity,
            maxQuantity: dropEntry.maxQuantity,
          },
        );
      }
    });
  });

  const enhancement = assertRecord(root.enhancement, '$.enhancement');
  assertNumber(enhancement.maxLevel, '$.enhancement.maxLevel', {
    integer: true,
    min: 1,
  });
  assertNumberRecord(enhancement.successRates, '$.enhancement.successRates');
  assertNumberRecord(enhancement.goldCosts, '$.enhancement.goldCosts');
  assertNumberRecord(
    enhancement.materialCounts,
    '$.enhancement.materialCounts',
  );
  const materialsBySlot = assertRecord(
    enhancement.materialsBySlot,
    '$.enhancement.materialsBySlot',
  );
  ENHANCEMENT_SLOTS.forEach((slot) => {
    assertString(
      materialsBySlot[slot],
      `$.enhancement.materialsBySlot.${slot}`,
      { minLength: 1 },
    );
  });

  const dismantle = assertRecord(root.dismantle, '$.dismantle');
  const baseMaterialQuantityByRarity = assertRecord(
    dismantle.baseMaterialQuantityByRarity,
    '$.dismantle.baseMaterialQuantityByRarity',
  );
  CATALOG_RARITIES.forEach((rarity) => {
    assertNumber(
      baseMaterialQuantityByRarity[rarity],
      `$.dismantle.baseMaterialQuantityByRarity.${rarity}`,
      { integer: true, min: 0 },
    );
  });
  assertNumberRecord(
    dismantle.refundByEnhancementLevel,
    '$.dismantle.refundByEnhancementLevel',
  );

  if (root.assetsBaseUrl !== undefined && root.assetsBaseUrl !== null) {
    assertString(root.assetsBaseUrl, '$.assetsBaseUrl', { minLength: 1 });
  }
  if (root.spriteMap !== undefined && root.spriteMap !== null) {
    assertStringRecord(root.spriteMap, '$.spriteMap');
  }

  return input as CatalogData;
};

export const assertCatalogData = (input: unknown): CatalogData => {
  return assertCatalogDataShape(input);
};

/**
 * Catalog 데이터를 검증한다.
 * fail-fast 방식으로 동작해 첫 번째 검증 실패만 반환한다.
 */
export const validateCatalogData = (
  input: unknown,
): CatalogValidationResult => {
  try {
    const data = assertCatalogDataShape(input);
    return {
      success: true,
      data,
      errors: [],
    };
  } catch (error) {
    if (error instanceof RuntimeValidationError) {
      return {
        success: false,
        data: undefined,
        errors: [
          {
            path: error.path,
            expected: error.expected,
            value: error.value,
          },
        ],
      };
    }
    throw error;
  }
};
