import {
  DungeonLogAction,
  DungeonLogStatus,
  UserCollectionTargetType,
} from '@prisma/client';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { loadCatalogData } from '../catalog';
import type { PrismaService } from '../prisma/prisma.service';
import {
  CollectionTrackerService,
  type CollectionDiscovery,
} from './collection-tracker.service';

vi.mock('../catalog', () => ({
  loadCatalogData: vi.fn(),
}));

describe('CollectionTrackerService', () => {
  const prismaMock = {
    userCollectionEntry: {
      upsert: vi.fn(),
    },
  };
  const loadCatalogDataMock = vi.mocked(loadCatalogData);
  const service = new CollectionTrackerService(
    prismaMock as unknown as PrismaService,
  );
  const warnSpy = vi
    .spyOn(
      (service as unknown as { logger: { warn: (message: string) => void } })
        .logger,
      'warn',
    )
    .mockImplementation(() => undefined);

  beforeEach(() => {
    prismaMock.userCollectionEntry.upsert.mockReset();
    loadCatalogDataMock.mockReset();
    warnSpy.mockClear();
  });

  it('BATTLE STARTED/COMPLETED 로그에서 monster code를 추출한다', () => {
    const started = service.extractDiscoveriesFromLog({
      action: DungeonLogAction.BATTLE,
      status: DungeonLogStatus.STARTED,
      extra: { details: { monster: { code: 'monster-goblin' } } },
      createdAt: new Date('2026-02-13T00:00:00.000Z'),
    });
    const completed = service.extractDiscoveriesFromLog({
      action: DungeonLogAction.BATTLE,
      status: DungeonLogStatus.COMPLETED,
      extra: { details: { monster: { code: 'monster-orc' } } },
      createdAt: new Date('2026-02-13T01:00:00.000Z'),
    });

    expect(started).toEqual([
      {
        targetType: UserCollectionTargetType.MONSTER,
        targetCode: 'monster-goblin',
        firstDiscoveredAt: new Date('2026-02-13T00:00:00.000Z'),
      },
    ]);
    expect(completed).toEqual([
      {
        targetType: UserCollectionTargetType.MONSTER,
        targetCode: 'monster-orc',
        firstDiscoveredAt: new Date('2026-02-13T01:00:00.000Z'),
      },
    ]);
  });

  it('ACQUIRE_ITEM/DISMANTLE_ITEM 로그의 added code를 추출한다', () => {
    const discovered = service.extractDiscoveriesFromLogs([
      {
        action: DungeonLogAction.ACQUIRE_ITEM,
        status: DungeonLogStatus.COMPLETED,
        delta: {
          detail: {
            inventory: {
              added: [
                { code: 'material-metal-scrap' },
                { code: 'weapon-iron-sword' },
              ],
            },
          },
        },
        createdAt: new Date('2026-02-13T01:00:00.000Z'),
      },
      {
        action: DungeonLogAction.DISMANTLE_ITEM,
        status: DungeonLogStatus.COMPLETED,
        delta: {
          detail: {
            inventory: {
              added: [{ code: 'material-metal-scrap' }],
            },
          },
        },
        createdAt: new Date('2026-02-13T02:00:00.000Z'),
      },
    ]);

    expect(discovered).toEqual([
      {
        targetType: UserCollectionTargetType.ITEM,
        targetCode: 'material-metal-scrap',
        firstDiscoveredAt: new Date('2026-02-13T01:00:00.000Z'),
      },
      {
        targetType: UserCollectionTargetType.ITEM,
        targetCode: 'weapon-iron-sword',
        firstDiscoveredAt: new Date('2026-02-13T01:00:00.000Z'),
      },
    ]);
  });

  it('빈 코드가 있으면 경고하고 제외한다', () => {
    const discovered = service.extractDiscoveriesFromLog({
      action: DungeonLogAction.ACQUIRE_ITEM,
      status: DungeonLogStatus.COMPLETED,
      delta: {
        detail: {
          inventory: {
            added: [{ code: '  ' }, { code: 'material-emerald-frag' }],
          },
        },
      },
      createdAt: new Date('2026-02-13T03:00:00.000Z'),
    });

    expect(discovered).toEqual([
      {
        targetType: UserCollectionTargetType.ITEM,
        targetCode: 'material-emerald-frag',
        firstDiscoveredAt: new Date('2026-02-13T03:00:00.000Z'),
      },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('카탈로그에 없는 코드는 업서트하지 않고 경고한다', async () => {
    loadCatalogDataMock.mockResolvedValue({
      version: 1,
      updatedAt: '2026-02-13T00:00:00.000Z',
      items: [
        {
          code: 'material-metal-scrap',
          name: 'Metal Scrap',
          nameKey: 'item.material-metal-scrap',
          slot: 'material',
          rarity: 'common',
          modifiers: [],
          spriteId: 'material-metal-scrap',
        },
      ],
      buffs: [],
      monsters: [
        {
          code: 'monster-goblin',
          name: 'Goblin',
          nameKey: 'monster.goblin',
          rarity: 'normal',
          hp: 10,
          atk: 3,
          def: 1,
          spriteId: 'monster-goblin',
        },
      ],
      dropTables: [],
      enhancement: {
        maxLevel: 10,
        successRates: {},
        goldCosts: {},
        materialCounts: {},
        materialsBySlot: {
          weapon: 'material-metal-scrap',
          armor: 'material-metal-scrap',
          helmet: 'material-metal-scrap',
          ring: 'material-metal-scrap',
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
    prismaMock.userCollectionEntry.upsert.mockResolvedValue({});

    const discoveries: CollectionDiscovery[] = [
      {
        targetType: UserCollectionTargetType.ITEM,
        targetCode: 'material-metal-scrap',
        firstDiscoveredAt: new Date('2026-02-13T00:00:00.000Z'),
      },
      {
        targetType: UserCollectionTargetType.ITEM,
        targetCode: 'item-unknown',
        firstDiscoveredAt: new Date('2026-02-13T00:00:00.000Z'),
      },
      {
        targetType: UserCollectionTargetType.MONSTER,
        targetCode: 'monster-goblin',
        firstDiscoveredAt: new Date('2026-02-13T00:00:00.000Z'),
      },
    ];

    const result = await service.upsertDiscoveries(
      '00000000-0000-4000-8000-000000000001',
      discoveries,
    );

    expect(result).toBe(2);
    expect(prismaMock.userCollectionEntry.upsert).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      'collection: skip unknown catalog code type=ITEM code=item-unknown',
    );
  });
});
