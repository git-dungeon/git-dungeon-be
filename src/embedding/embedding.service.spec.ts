/// <reference types="vitest" />
import type { PrismaService } from '../prisma/prisma.service';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { InventoryService } from '../inventory/inventory.service';
import {
  createDashboardStateResponse,
  createInventoryResponse,
  TEST_INVENTORY_ITEM_ID_1,
  TEST_USER_ID_1,
} from '../test-support/fixtures';
import {
  resetTypiaAssertMock,
  typiaAssertMock,
} from '../test-support/mocks/typia';
import { EmbeddingService } from './embedding.service';
import { loadCatalogData } from '../catalog';
import type { EmbedRendererService } from './embed-renderer.service';

vi.mock('typia', async () => {
  const { typiaModuleMock } = await import('../test-support/mocks/typia');
  return typiaModuleMock;
});

vi.mock('../catalog', () => ({
  loadCatalogData: vi.fn(),
}));

describe('EmbeddingService', () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const dashboardServiceMock = {
    getState: vi.fn(),
  };
  const inventoryServiceMock = {
    getInventory: vi.fn(),
  };
  const embedRendererServiceMock = {
    renderPreviewSvg: vi.fn(),
  };
  const loadCatalogDataMock = vi.mocked(loadCatalogData);

  const service = new EmbeddingService(
    prismaMock as unknown as PrismaService,
    dashboardServiceMock as unknown as DashboardService,
    inventoryServiceMock as unknown as InventoryService,
    embedRendererServiceMock as unknown as EmbedRendererService,
  );

  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    dashboardServiceMock.getState.mockReset();
    inventoryServiceMock.getInventory.mockReset();
    embedRendererServiceMock.renderPreviewSvg.mockReset();
    loadCatalogDataMock.mockReset();
    resetTypiaAssertMock();
  });

  it('overview를 매핑하고 장착 슬롯만 포함해야 한다', async () => {
    const weaponItem = {
      id: TEST_INVENTORY_ITEM_ID_1,
      code: 'weapon-longsword',
      name: null,
      slot: 'weapon',
      rarity: 'rare',
      modifiers: [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'def', mode: 'percent', value: 0.5 },
      ],
      effect: null,
      sprite: null,
      createdAt: '2025-10-30T09:00:00.000Z',
      isEquipped: true,
      version: 3,
    };
    const consumableItem = {
      id: '22222222-2222-4222-8222-222222222222',
      code: 'consumable-potion',
      name: 'Potion',
      slot: 'consumable',
      rarity: 'common',
      modifiers: [],
      effect: null,
      sprite: null,
      createdAt: '2025-10-30T09:00:00.000Z',
      isEquipped: true,
      version: 1,
    };

    const dashboardResponse = createDashboardStateResponse({
      level: 8,
      exp: 54,
      expToLevel: 80,
      gold: 640,
      ap: 18,
      hp: 32,
      maxHp: 40,
      atk: 18,
      def: 14,
      luck: 6,
      floor: 13,
      maxFloor: 15,
      floorProgress: 60,
      stats: {
        base: { hp: 28, atk: 16, def: 13, luck: 6 },
        equipmentBonus: { hp: 4, atk: 2, def: 1, luck: 0 },
        total: { hp: 32, atk: 18, def: 14, luck: 6 },
      },
    });

    const inventoryResponse = createInventoryResponse({
      items: [weaponItem, consumableItem],
      equipped: {
        weapon: weaponItem,
        consumable: consumableItem,
      },
    });

    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2025-10-30T10:00:00.000Z',
      items: [
        {
          code: 'weapon-longsword',
          nameKey: 'item.weapon-longsword.name',
          descriptionKey: 'item.weapon-longsword.desc',
          name: 'Longsword',
          slot: 'weapon',
          rarity: 'rare',
          modifiers: [],
          effectCode: 'bleed-1',
          spriteId: 'sprite/weapon-longsword',
          description: '출혈',
        },
      ],
      buffs: [],
      monsters: [],
      dropTables: [],
      assetsBaseUrl: null,
      spriteMap: {
        'sprite/weapon-longsword': 'https://cdn.example.com/weapon.png',
      },
    });

    dashboardServiceMock.getState.mockResolvedValue(dashboardResponse);
    inventoryServiceMock.getInventory.mockResolvedValue(inventoryResponse);
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID_1,
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
    });

    const result = await service.getPreview({
      userId: TEST_USER_ID_1,
      theme: 'light',
      size: 'compact',
      language: 'en',
    });

    expect(loadCatalogDataMock).toHaveBeenCalledWith(undefined, undefined, {
      locale: 'en',
      includeStrings: true,
    });

    expect(result.theme).toBe('light');
    expect(result.size).toBe('compact');
    expect(result.language).toBe('en');
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(result.overview.displayName).toBe('Mock User');
    expect(result.overview.avatarUrl).toBe('https://example.com/avatar.png');
    expect(result.overview.floor).toEqual({
      current: 13,
      best: 15,
      progress: 60,
    });
    expect(result.overview.stats.equipmentBonus).toEqual({
      hp: 4,
      maxHp: 4,
      atk: 2,
      def: 1,
      luck: 0,
      ap: 0,
    });
    expect(result.overview.stats.base).toEqual({
      hp: 28,
      maxHp: 36,
      atk: 16,
      def: 13,
      luck: 6,
      ap: 18,
    });
    expect(result.overview.equipment).toHaveLength(1);
    expect(result.overview.equipment[0]).toEqual({
      id: TEST_INVENTORY_ITEM_ID_1,
      code: 'weapon-longsword',
      name: 'Longsword',
      slot: 'weapon',
      rarity: 'rare',
      modifiers: [{ stat: 'atk', value: 5 }],
      effect: { type: 'bleed-1', description: '출혈' },
      sprite: 'https://cdn.example.com/weapon.png',
      createdAt: '2025-10-30T09:00:00.000Z',
      isEquipped: true,
    });

    expect(typiaAssertMock).toHaveBeenCalledTimes(1);
  });

  it('theme/size/language 기본값을 사용해야 한다', async () => {
    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2025-10-30T10:00:00.000Z',
      items: [],
      buffs: [],
      monsters: [],
      dropTables: [],
      assetsBaseUrl: null,
      spriteMap: {},
    });

    dashboardServiceMock.getState.mockResolvedValue(
      createDashboardStateResponse(),
    );
    inventoryServiceMock.getInventory.mockResolvedValue(
      createInventoryResponse(),
    );
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID_1,
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
    });

    const result = await service.getPreview({ userId: TEST_USER_ID_1 });

    expect(result.theme).toBe('dark');
    expect(result.size).toBe('wide');
    expect(result.language).toBe('ko');
  });

  it('SVG 프리뷰 렌더링을 호출해야 한다', async () => {
    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2025-10-30T10:00:00.000Z',
      items: [],
      buffs: [],
      monsters: [],
      dropTables: [],
      assetsBaseUrl: null,
      spriteMap: {},
    });

    dashboardServiceMock.getState.mockResolvedValue(
      createDashboardStateResponse(),
    );
    inventoryServiceMock.getInventory.mockResolvedValue(
      createInventoryResponse(),
    );
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID_1,
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
    });
    embedRendererServiceMock.renderPreviewSvg.mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );

    const result = await service.getPreviewSvg({ userId: TEST_USER_ID_1 });

    expect(embedRendererServiceMock.renderPreviewSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        size: 'wide',
        language: 'ko',
        overview: expect.any(Object),
      }),
    );
    expect(result).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  });
});
