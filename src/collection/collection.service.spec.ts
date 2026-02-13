import { describe, expect, it, beforeEach, vi } from 'vitest';
import { UserCollectionTargetType } from '@prisma/client';
import { loadCatalogData } from '../catalog';
import type { PrismaService } from '../prisma/prisma.service';
import { CollectionService } from './collection.service';

vi.mock('../catalog', () => ({
  loadCatalogData: vi.fn(),
}));

describe('CollectionService', () => {
  const prismaMock = {
    userCollectionEntry: {
      findMany: vi.fn(),
    },
  };

  const loadCatalogDataMock = vi.mocked(loadCatalogData);

  let service: CollectionService;

  beforeEach(() => {
    prismaMock.userCollectionEntry.findMany.mockReset();
    loadCatalogDataMock.mockReset();
    service = new CollectionService(prismaMock as unknown as PrismaService);
  });

  it('discovered/total/percent를 계산하고 discovered code 목록을 반환한다', async () => {
    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2026-02-13T00:00:00.000Z',
      items: [
        {
          code: 'item-a',
          name: 'Item A',
          nameKey: 'item.a',
          slot: 'weapon',
          rarity: 'common',
          spriteId: 'item-a',
        },
        {
          code: 'material-b',
          name: 'Material B',
          nameKey: 'material.b',
          slot: 'material',
          rarity: 'common',
          spriteId: 'material-b',
        },
        {
          code: 'item-c',
          name: 'Item C',
          nameKey: 'item.c',
          slot: 'armor',
          rarity: 'rare',
          spriteId: 'item-c',
        },
      ],
      buffs: [],
      monsters: [
        {
          code: 'monster-a',
          name: 'Monster A',
          nameKey: 'monster.a',
          rarity: 'common',
          hp: 10,
          atk: 3,
          def: 1,
          spriteId: 'monster-a',
        },
        {
          code: 'monster-b',
          name: 'Monster B',
          nameKey: 'monster.b',
          rarity: 'rare',
          hp: 20,
          atk: 5,
          def: 3,
          spriteId: 'monster-b',
        },
      ],
      dropTables: [],
      enhancement: {
        maxLevel: 10,
        successRates: {},
        goldCosts: {},
        materialCounts: {},
        materialsBySlot: {
          weapon: 'material-b',
          armor: 'material-b',
          helmet: 'material-b',
          ring: 'material-b',
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
        refundByEnhancementLevel: { '0': 0 },
      },
      assetsBaseUrl: null,
      spriteMap: null,
    });

    prismaMock.userCollectionEntry.findMany
      .mockResolvedValueOnce([
        { targetCode: 'material-b' },
        { targetCode: 'item-a' },
        { targetCode: 'unknown-item' },
      ])
      .mockResolvedValueOnce([
        { targetCode: 'monster-b' },
        { targetCode: 'unknown-monster' },
      ]);

    const response = await service.getCollection(
      '00000000-0000-4000-8000-000000000001',
    );

    expect(response).toEqual({
      summary: {
        items: { discovered: 2, total: 3, percent: 67 },
        monsters: { discovered: 1, total: 2, percent: 50 },
        overall: { discovered: 3, total: 5, percent: 60 },
      },
      items: {
        discoveredCodes: ['item-a', 'material-b'],
      },
      monsters: {
        discoveredCodes: ['monster-b'],
      },
    });

    expect(prismaMock.userCollectionEntry.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: '00000000-0000-4000-8000-000000000001',
        targetType: UserCollectionTargetType.ITEM,
      },
      select: { targetCode: true },
      orderBy: { targetCode: 'asc' },
    });
    expect(prismaMock.userCollectionEntry.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: '00000000-0000-4000-8000-000000000001',
        targetType: UserCollectionTargetType.MONSTER,
      },
      select: { targetCode: true },
      orderBy: { targetCode: 'asc' },
    });
  });

  it('catalog total이 0이면 percent를 0으로 반환한다', async () => {
    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2026-02-13T00:00:00.000Z',
      items: [],
      buffs: [],
      monsters: [],
      dropTables: [],
      enhancement: {
        maxLevel: 10,
        successRates: {},
        goldCosts: {},
        materialCounts: {},
        materialsBySlot: {
          weapon: 'material-none',
          armor: 'material-none',
          helmet: 'material-none',
          ring: 'material-none',
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
        refundByEnhancementLevel: { '0': 0 },
      },
      assetsBaseUrl: null,
      spriteMap: null,
    });

    prismaMock.userCollectionEntry.findMany
      .mockResolvedValueOnce([{ targetCode: 'item-a' }])
      .mockResolvedValueOnce([{ targetCode: 'monster-a' }]);

    const response = await service.getCollection(
      '00000000-0000-4000-8000-000000000001',
    );

    expect(response).toEqual({
      summary: {
        items: { discovered: 0, total: 0, percent: 0 },
        monsters: { discovered: 0, total: 0, percent: 0 },
        overall: { discovered: 0, total: 0, percent: 0 },
      },
      items: {
        discoveredCodes: [],
      },
      monsters: {
        discoveredCodes: [],
      },
    });
  });
});
