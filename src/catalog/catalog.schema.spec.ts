import { describe, expect, it } from 'vitest';
import { validateCatalogData } from './catalog.schema';

const createValidCatalog = () => ({
  version: 1,
  updatedAt: '2026-02-06T00:00:00.000Z',
  items: [
    {
      code: 'weapon-sword',
      nameKey: 'item.weapon-sword.name',
      descriptionKey: 'item.weapon-sword.description',
      name: 'Sword',
      slot: 'weapon',
      rarity: 'common',
      modifiers: [
        {
          kind: 'stat',
          stat: 'atk',
          mode: 'flat',
          value: 3,
        },
      ],
      effectCode: null,
      spriteId: 'sprite/weapon-sword',
      description: null,
    },
  ],
  buffs: [],
  monsters: [],
  dropTables: [
    {
      tableId: 'drop-default',
      drops: [
        {
          code: 'material-scrap',
          weight: 1,
          minQuantity: 1,
          maxQuantity: 2,
        },
      ],
    },
  ],
  enhancement: {
    maxLevel: 10,
    successRates: { '1': 1 },
    goldCosts: { '1': 100 },
    materialCounts: { '1': 1 },
    materialsBySlot: {
      helmet: 'material-helmet',
      armor: 'material-armor',
      weapon: 'material-weapon',
      ring: 'material-ring',
    },
  },
  dismantle: {
    baseMaterialQuantityByRarity: {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5,
    },
    refundByEnhancementLevel: {
      '0': 0,
    },
  },
  assetsBaseUrl: null,
  spriteMap: null,
});

describe('catalog.schema', () => {
  it('drop 수량 범위가 역전되면 실패해야 한다', () => {
    const payload = createValidCatalog();
    payload.dropTables[0].drops[0].minQuantity = 5;
    payload.dropTables[0].drops[0].maxQuantity = 1;

    const result = validateCatalogData(payload);

    expect(result.success).toBe(false);
    expect(result.errors[0]?.expected).toBe('minQuantity <= maxQuantity');
  });

  it('optional 문자열 필드의 타입이 잘못되면 실패해야 한다', () => {
    const payload = createValidCatalog();
    payload.items[0].descriptionKey = 123 as unknown as string;

    const result = validateCatalogData(payload);

    expect(result.success).toBe(false);
    expect(result.errors[0]?.path).toBe('$.items[0].descriptionKey');
  });

  it('modifier 구조가 잘못되면 실패해야 한다', () => {
    const payload = createValidCatalog();
    payload.items[0].modifiers = [
      {
        kind: 'stat',
        stat: 'atk',
      } as unknown as (typeof payload.items)[number]['modifiers'][number],
    ];

    const result = validateCatalogData(payload);

    expect(result.success).toBe(false);
    expect(result.errors[0]?.path).toBe('$.items[0].modifiers[0].value');
  });
});
