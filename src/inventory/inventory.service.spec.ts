/// <reference types="vitest" />
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';
import { DungeonLogAction, DungeonLogCategory } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StatsCacheService } from '../common/stats/stats-cache.service';
import { loadCatalogData } from '../catalog';
import seedrandom from 'seedrandom';
import {
  resetTypiaAssertMock,
  typiaAssertMock,
} from '../test-support/mocks/typia';
import { MockTypeGuardError } from '../test-support/mocks/typia';

const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
const USER_ID_2 = '00000000-0000-4000-8000-000000000002';
const ITEM_ID_WEAPON = '11111111-1111-4111-8111-111111111111';
const ITEM_ID_BACKPACK = '22222222-2222-4222-8222-222222222222';
const ITEM_ID_GENERIC = '33333333-3333-4333-8333-333333333333';

vi.mock('typia', async () => {
  const { typiaModuleMock } = await import('../test-support/mocks/typia');
  return typiaModuleMock;
});

vi.mock('../catalog', () => ({
  loadCatalogData: vi.fn(),
}));
vi.mock('seedrandom', () => ({
  default: vi.fn(),
}));

const loadCatalogDataMock = vi.mocked(loadCatalogData);
const seedrandomMock = vi.mocked(seedrandom);

describe('InventoryService', () => {
  const prismaMock = {
    dungeonState: {
      findUnique: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
    },
  };

  const statsCacheService = new StatsCacheService(
    prismaMock as unknown as PrismaService,
  );
  const statsCacheMock = vi.spyOn(statsCacheService, 'ensureStatsCache');
  const service = new InventoryService(
    prismaMock as unknown as PrismaService,
    statsCacheService,
  );

  beforeEach(() => {
    prismaMock.dungeonState.findUnique.mockReset();
    prismaMock.inventoryItem.findMany.mockReset();
    statsCacheMock.mockReset();
    loadCatalogDataMock.mockReset();
    seedrandomMock.mockImplementation(
      () => ({ quick: () => 0.5 }) as unknown as { quick: () => number },
    );
    statsCacheMock.mockResolvedValue({
      hp: 0,
      maxHp: 0,
      atk: 0,
      def: 0,
      luck: 0,
    });
    resetTypiaAssertMock();
  });

  it('인벤토리를 조회해 summary/버전이 계산되어야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      hp: 10,
      maxHp: 10,
      atk: 5,
      def: 3,
      luck: 1,
    });

    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: ITEM_ID_WEAPON,
        userId: USER_ID_1,
        code: 'weapon-longsword',
        slot: 'weapon',
        rarity: 'RARE',
        modifiers: [
          { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
          { kind: 'stat', stat: 'def', mode: 'percent', value: 0.5 },
        ],
        isEquipped: true,
        obtainedAt: new Date('2025-10-30T09:00:00.000Z'),
        version: 3,
      },
      {
        id: ITEM_ID_BACKPACK,
        userId: USER_ID_1,
        code: 'consumable-slot',
        slot: 'CONSUMABLE',
        rarity: 'COMMON',
        modifiers: [],
        isEquipped: false,
        obtainedAt: new Date('2025-10-30T10:00:00.000Z'),
        version: 1,
      },
    ]);
    statsCacheMock.mockResolvedValue({
      hp: 0,
      maxHp: 0,
      atk: 5,
      def: 1,
      luck: 0,
    });

    const response = await service.getInventory(USER_ID_1);

    expect(response.items).toHaveLength(2);
    expect(response.version).toBe(3);
    expect(response.equipped.weapon?.id).toBe(ITEM_ID_WEAPON);
    expect(response.summary.base).toEqual({
      hp: 10,
      maxHp: 10,
      atk: 5,
      def: 3,
      luck: 1,
    });
    expect(response.summary.equipmentBonus).toEqual({
      hp: 0,
      maxHp: 0,
      atk: 5,
      def: 1,
      luck: 0,
    });
    expect(response.summary.total).toEqual({
      hp: 10,
      maxHp: 10,
      atk: 10,
      def: 4,
      luck: 1,
    });
    expect(statsCacheMock).toHaveBeenCalledTimes(1);
    expect(statsCacheMock).toHaveBeenCalledWith(USER_ID_1, prismaMock, {
      forceRefresh: undefined,
    });
    expect(typiaAssertMock).toHaveBeenCalledTimes(1);
  });

  it('인벤토리가 없으면 버전 0과 빈 슬롯을 반환해야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      hp: 8,
      maxHp: 8,
      atk: 3,
      def: 2,
      luck: 1,
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    statsCacheMock.mockResolvedValue({
      hp: 0,
      maxHp: 0,
      atk: 0,
      def: 0,
      luck: 0,
    });

    const response = await service.getInventory(USER_ID_1);

    expect(response.version).toBe(0);
    expect(response.items).toEqual([]);
    expect(response.equipped).toEqual({});
    expect(response.summary.base).toEqual({
      hp: 8,
      maxHp: 8,
      atk: 3,
      def: 2,
      luck: 1,
    });
    expect(response.summary.total).toEqual({
      hp: 8,
      maxHp: 8,
      atk: 3,
      def: 2,
      luck: 1,
    });
    expect(response.summary.equipmentBonus).toEqual({
      hp: 0,
      maxHp: 0,
      atk: 0,
      def: 0,
      luck: 0,
    });
  });

  it('던전 상태가 없으면 INVENTORY_UNAUTHORIZED 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue(null);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    statsCacheMock.mockRejectedValue(
      new UnauthorizedException({
        code: 'INVENTORY_UNAUTHORIZED',
        message: '인벤토리를 조회할 수 없습니다.',
      }),
    );

    await expect(service.getInventory(USER_ID_1)).rejects.toMatchObject({
      constructor: UnauthorizedException,
      response: { code: 'INVENTORY_UNAUTHORIZED' },
    });
  });

  it('typia 검증 실패 시 로깅 후 INVENTORY_INVALID_RESPONSE 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      hp: 10,
      maxHp: 10,
      atk: 5,
      def: 3,
      luck: 1,
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    statsCacheMock.mockResolvedValue({
      hp: 0,
      maxHp: 0,
      atk: 0,
      def: 0,
      luck: 0,
    });

    const loggerSpy = vi.spyOn(
      (
        service as unknown as {
          logger: { error: (...params: unknown[]) => void };
        }
      ).logger,
      'error',
    );
    loggerSpy.mockImplementation(() => undefined);

    typiaAssertMock.mockImplementationOnce(() => {
      throw new MockTypeGuardError('items', 'InventoryResponse', null);
    });

    await expect(service.getInventory(USER_ID_1)).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: { code: 'INVENTORY_INVALID_RESPONSE' },
    });

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    loggerSpy.mockRestore();
  });
});

describe('InventoryService mutations', () => {
  const SWORD_ID = '44444444-4444-4444-8444-444444444444';
  const DAGGER_ID = '55555555-5555-4555-8555-555555555555';
  const RING_ID = '66666666-6666-4666-8666-666666666666';
  const POTION_ID = '77777777-7777-4777-8777-777777777777';

  const createItem = (
    overrides: Partial<{
      id: string;
      userId: string;
      code: string;
      slot: 'WEAPON' | 'ARMOR' | 'HELMET' | 'RING' | 'CONSUMABLE' | 'MATERIAL';
      rarity: string;
      modifiers: unknown;
      isEquipped: boolean;
      enhancementLevel: number;
      obtainedAt: Date;
      version: number;
      quantity: number;
    }>,
  ) => ({
    id: ITEM_ID_GENERIC,
    userId: USER_ID_1,
    code: 'weapon-longsword',
    slot: 'WEAPON' as const,
    rarity: 'RARE',
    modifiers: [],
    isEquipped: false,
    enhancementLevel: 0,
    obtainedAt: new Date('2025-10-30T09:00:00.000Z'),
    version: 1,
    quantity: 1,
    ...overrides,
  });

  const createPrismaMock = ({
    dungeonState,
    items,
    rngNext = 0.5,
  }: {
    dungeonState: {
      userId: string;
      hp: number;
      maxHp: number;
      atk: number;
      def: number;
      luck: number;
      gold?: number;
    };
    items: Array<{
      id: string;
      userId: string;
      code: string;
      slot: 'WEAPON' | 'ARMOR' | 'HELMET' | 'RING' | 'CONSUMABLE' | 'MATERIAL';
      rarity: string;
      modifiers: unknown;
      isEquipped: boolean;
      enhancementLevel?: number;
      obtainedAt: Date;
      version: number;
      quantity: number;
    }>;
    rngNext?: number;
  }) => {
    let inventoryItems = [...items];
    let dungeonStateSnapshot = {
      ...dungeonState,
      gold: dungeonState.gold ?? 0,
    };
    const dungeonLogCreates: unknown[] = [];
    const prismaMock = {
      dungeonState: {
        findUnique: vi.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve(
            where.userId === dungeonStateSnapshot.userId
              ? dungeonStateSnapshot
              : null,
          ),
        ),
        update: vi.fn(
          ({ data }: { data: { gold?: { decrement: number } } }) => {
            if (data.gold?.decrement) {
              dungeonStateSnapshot = {
                ...dungeonStateSnapshot,
                gold: dungeonStateSnapshot.gold - data.gold.decrement,
              };
            }
            return Promise.resolve(dungeonStateSnapshot);
          },
        ),
        updateMany: vi.fn(
          ({
            where,
            data,
          }: {
            where: { userId: string; gold?: { gte: number } };
            data: { gold?: { decrement: number } };
          }) => {
            if (where.userId !== dungeonStateSnapshot.userId) {
              return Promise.resolve({ count: 0 });
            }

            const minGold = where.gold?.gte;
            if (
              typeof minGold === 'number' &&
              dungeonStateSnapshot.gold < minGold
            ) {
              return Promise.resolve({ count: 0 });
            }

            const decrement = data.gold?.decrement;
            if (typeof decrement === 'number') {
              dungeonStateSnapshot = {
                ...dungeonStateSnapshot,
                gold: dungeonStateSnapshot.gold - decrement,
              };
            }

            return Promise.resolve({ count: 1 });
          },
        ),
      },
      inventoryItem: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            inventoryItems.find((item) => item.id === where.id) ?? null,
          ),
        ),
        findFirst: vi.fn(
          ({
            where,
          }: {
            where: { userId: string; slot: string; isEquipped: boolean };
          }) =>
            Promise.resolve(
              inventoryItems.find(
                (item) =>
                  item.userId === where.userId &&
                  item.slot === where.slot &&
                  item.isEquipped === where.isEquipped,
              ) ?? null,
            ),
        ),
        findMany: vi.fn(
          ({
            where,
            orderBy,
          }: {
            where: {
              userId: string;
              code?: string;
              slot?: string;
              isEquipped?: boolean;
            };
            orderBy?: { obtainedAt?: 'asc' | 'desc' };
          }) => {
            let filtered = inventoryItems.filter(
              (item) => item.userId === where.userId,
            );

            if (where.code) {
              filtered = filtered.filter((item) => item.code === where.code);
            }

            if (where.slot) {
              filtered = filtered.filter((item) => item.slot === where.slot);
            }

            if (where.isEquipped !== undefined) {
              filtered = filtered.filter(
                (item) => item.isEquipped === where.isEquipped,
              );
            }

            const sorted = filtered.sort(
              (a, b) => a.obtainedAt.getTime() - b.obtainedAt.getTime(),
            );

            if (orderBy?.obtainedAt === 'desc') {
              sorted.reverse();
            }

            return Promise.resolve(sorted);
          },
        ),
        updateMany: vi.fn(
          ({
            where,
            data,
          }: {
            where: { id: string; userId: string; version: number };
            data: {
              isEquipped?: boolean;
              version?: { increment: number };
              enhancementLevel?: number;
              quantity?:
                | number
                | { increment?: number; decrement?: number; set?: number };
            };
          }) => {
            let count = 0;
            inventoryItems = inventoryItems.map((item) => {
              if (
                item.id === where.id &&
                item.userId === where.userId &&
                item.version === where.version
              ) {
                count += 1;
                const nextQuantity =
                  data.quantity === undefined
                    ? item.quantity
                    : typeof data.quantity === 'number'
                      ? data.quantity
                      : typeof data.quantity.increment === 'number'
                        ? item.quantity + data.quantity.increment
                        : typeof data.quantity.decrement === 'number'
                          ? item.quantity - data.quantity.decrement
                          : typeof data.quantity.set === 'number'
                            ? data.quantity.set
                            : item.quantity;

                return {
                  ...item,
                  ...(data.isEquipped !== undefined
                    ? { isEquipped: data.isEquipped }
                    : {}),
                  ...(data.enhancementLevel !== undefined
                    ? { enhancementLevel: data.enhancementLevel }
                    : {}),
                  ...(data.quantity !== undefined
                    ? { quantity: nextQuantity }
                    : {}),
                  ...(data.version
                    ? { version: item.version + data.version.increment }
                    : {}),
                };
              }
              return item;
            });
            return Promise.resolve({ count });
          },
        ),
        update: vi.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              isEquipped?: boolean;
              quantity?: number;
              version?: number | { increment: number };
            };
          }) => {
            const targetIndex = inventoryItems.findIndex(
              (item) => item.id === where.id,
            );

            if (targetIndex < 0) {
              return Promise.reject(new Error('Record not found'));
            }

            const target = inventoryItems[targetIndex];
            const updated = {
              ...target,
              ...(data.isEquipped !== undefined
                ? { isEquipped: data.isEquipped }
                : {}),
              ...(data.quantity !== undefined
                ? { quantity: data.quantity }
                : {}),
              ...(data.version !== undefined
                ? {
                    version:
                      typeof data.version === 'number'
                        ? data.version
                        : target.version + data.version.increment,
                  }
                : {}),
            };

            inventoryItems = inventoryItems.map((item, index) =>
              index === targetIndex ? updated : item,
            );

            return Promise.resolve(updated);
          },
        ),
        create: vi.fn(({ data }: { data: unknown }) => {
          const payload = data as {
            id?: string;
            userId: string;
            code: string;
            slot: string;
            rarity: string;
            modifiers: unknown;
            isEquipped: boolean;
            quantity?: number;
            version: number;
          };
          inventoryItems.push({
            id: payload.id ?? ITEM_ID_GENERIC,
            userId: payload.userId,
            code: payload.code,
            slot: payload.slot as
              | 'WEAPON'
              | 'ARMOR'
              | 'HELMET'
              | 'RING'
              | 'CONSUMABLE'
              | 'MATERIAL',
            rarity: payload.rarity,
            modifiers: payload.modifiers,
            isEquipped: payload.isEquipped,
            obtainedAt: new Date('2025-10-30T09:00:00.000Z'),
            version: payload.version,
            quantity: payload.quantity ?? 1,
          });
          return Promise.resolve(payload);
        }),
        deleteMany: vi.fn(
          ({
            where,
          }: {
            where:
              | { id: string; userId: string; version?: number }
              | { id: { in: string[] }; userId: string };
          }) => {
            const before = inventoryItems.length;

            if (typeof where.id === 'string') {
              const whereWithVersion = where as {
                id: string;
                userId: string;
                version?: number;
              };
              inventoryItems = inventoryItems.filter(
                (item) =>
                  !(
                    item.id === whereWithVersion.id &&
                    item.userId === whereWithVersion.userId &&
                    (whereWithVersion.version === undefined ||
                      item.version === whereWithVersion.version)
                  ),
              );
            } else {
              const ids = new Set(where.id.in);
              inventoryItems = inventoryItems.filter(
                (item) => !(item.userId === where.userId && ids.has(item.id)),
              );
            }

            const after = inventoryItems.length;
            return Promise.resolve({ count: before - after });
          },
        ),
        aggregate: vi.fn(({ where }: { where: { userId: string } }) => {
          const versions = inventoryItems
            .filter((item) => item.userId === where.userId)
            .map((item) => item.version);
          return Promise.resolve({
            _max: { version: versions.length ? Math.max(...versions) : null },
          });
        }),
      },
      dungeonLog: {
        create: vi.fn(({ data }: { data: unknown }) => {
          dungeonLogCreates.push(data);
          return Promise.resolve(data);
        }),
      },
      $transaction: vi.fn((cb: (tx: PrismaService) => Promise<unknown>) =>
        cb(prismaMock as unknown as PrismaService),
      ),
    };

    const statsCacheService = new StatsCacheService(
      prismaMock as unknown as PrismaService,
    );
    const statsCacheMock = vi
      .spyOn(statsCacheService, 'ensureStatsCache')
      .mockResolvedValue({
        hp: 0,
        maxHp: 0,
        atk: 0,
        def: 0,
        luck: 0,
      });

    seedrandomMock.mockImplementation(
      () => ({ quick: () => rngNext }) as unknown as { quick: () => number },
    );

    return {
      service: new InventoryService(
        prismaMock as unknown as PrismaService,
        statsCacheService,
      ),
      prismaMock,
      statsCacheMock,
      getDungeonState: () => dungeonStateSnapshot,
      getItems: () => inventoryItems,
      getDungeonLogs: () => dungeonLogCreates,
    };
  };

  const baseDungeonState = {
    userId: USER_ID_1,
    hp: 8,
    maxHp: 8,
    atk: 3,
    def: 2,
    luck: 1,
    gold: 0,
  };

  const buildEnhancementConfig = () => ({
    maxLevel: 10,
    successRates: {
      '1': 0.5,
    },
    goldCosts: {
      '1': 10,
    },
    materialCounts: {
      '1': 2,
    },
    materialsBySlot: {
      weapon: 'material-metal-scrap',
      armor: 'material-cloth-scrap',
      helmet: 'material-leather-scrap',
      ring: 'material-mithril-dust',
    },
  });

  const buildCatalog = () => ({
    version: 1,
    updatedAt: '2026-02-01T00:00:00.000Z',
    items: [],
    buffs: [],
    monsters: [],
    dropTables: [],
    enhancement: buildEnhancementConfig(),
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
        '1': 0,
        '2': 1,
        '3': 3,
      },
    },
    assetsBaseUrl: null,
    spriteMap: null,
  });

  beforeEach(() => {
    loadCatalogDataMock.mockReset();
    loadCatalogDataMock.mockResolvedValue(buildCatalog());
  });

  it('equip: 기존 슬롯 해제 후 대상 아이템을 장착하고 버전을 증가시키며 로그를 남긴다', async () => {
    const { service, getItems, getDungeonLogs } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({ id: SWORD_ID, version: 1 }),
        createItem({
          id: DAGGER_ID,
          code: 'weapon-dagger',
          rarity: 'COMMON',
          isEquipped: true,
          obtainedAt: new Date('2025-10-30T08:00:00.000Z'),
          version: 2,
        }),
      ],
    });

    const response = await service.equipItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 1,
      inventoryVersion: 2,
    });

    expect(response.equipped.weapon?.id).toBe(SWORD_ID);
    expect(response.version).toBe(3);

    const items = getItems();
    const sword = items.find((item) => item.id === SWORD_ID);
    const dagger = items.find((item) => item.id === DAGGER_ID);

    expect(sword?.isEquipped).toBe(true);
    expect(sword?.version).toBe(2);
    expect(dagger?.isEquipped).toBe(false);
    expect(dagger?.version).toBe(3);

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.EQUIP_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it.each([
    ['WEAPON', 3, { atk: 3 }],
    ['ARMOR', 2, { def: 2 }],
    ['HELMET', 4, { def: 4 }],
    ['RING', 5, { luck: 5 }],
  ] as const)(
    'equip: 강화 레벨이 로그 statsDelta에 포함되어야 한다 (%s)',
    async (slot, enhancementLevel, expectedStats) => {
      const { service, getDungeonLogs, statsCacheMock, prismaMock } =
        createPrismaMock({
          dungeonState: baseDungeonState,
          items: [
            createItem({
              id: SWORD_ID,
              code: 'weapon-longsword',
              slot,
              rarity: 'RARE',
              modifiers: [],
              isEquipped: false,
              enhancementLevel,
              version: 1,
            }),
          ],
        });

      await service.equipItem(USER_ID_1, {
        itemId: SWORD_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(statsCacheMock).toHaveBeenCalledWith(USER_ID_1, prismaMock, {
        forceRefresh: true,
      });

      const logs = getDungeonLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0] as {
        action: string;
        delta?: { type?: string; detail?: { stats?: unknown } };
      };
      expect(log.action).toBe(DungeonLogAction.EQUIP_ITEM);
      expect(log.delta).toMatchObject({
        type: 'EQUIP_ITEM',
        detail: { stats: expectedStats },
      });
    },
  );

  it('equip: 슬롯 교체 시 강화 보너스를 포함한 차이만큼 statsDelta가 기록되어야 한다', async () => {
    const { service, getDungeonLogs } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          rarity: 'RARE',
          modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 5 }],
          enhancementLevel: 3,
          isEquipped: false,
          version: 1,
        }),
        createItem({
          id: DAGGER_ID,
          code: 'weapon-dagger',
          slot: 'WEAPON',
          rarity: 'COMMON',
          modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 2 }],
          enhancementLevel: 1,
          isEquipped: true,
          obtainedAt: new Date('2025-10-30T08:00:00.000Z'),
          version: 2,
        }),
      ],
    });

    await service.equipItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 1,
      inventoryVersion: 2,
    });

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);

    const log = logs[0] as {
      action: string;
      delta?: { type?: string; detail?: { stats?: unknown } };
    };
    expect(log.action).toBe(DungeonLogAction.EQUIP_ITEM);
    // (5 + 3) - (2 + 1) = +5
    expect(log.delta).toMatchObject({
      type: 'EQUIP_ITEM',
      detail: { stats: { atk: 5 } },
    });
  });

  it('equip: 버전 불일치 시 412를 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [createItem({ id: SWORD_ID, version: 2 })],
    });

    await expect(
      service.equipItem(USER_ID_1, {
        itemId: SWORD_ID,
        expectedVersion: 1,
        inventoryVersion: 2,
      }),
    ).rejects.toMatchObject({
      constructor: PreconditionFailedException,
      response: { code: 'INVENTORY_VERSION_MISMATCH' },
    });
  });

  it('unequip: 장착 상태가 아니면 409를 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: RING_ID,
          code: 'ring-topaz',
          slot: 'RING',
          rarity: 'UNCOMMON',
          isEquipped: false,
          version: 1,
        }),
      ],
    });

    await expect(
      service.unequipItem(USER_ID_1, {
        itemId: RING_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      }),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: { code: 'INVENTORY_SLOT_CONFLICT' },
    });
  });

  it('unequip: 성공 시 로그를 남긴다', async () => {
    const { service, getDungeonLogs } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: RING_ID,
          code: 'ring-topaz',
          slot: 'RING',
          rarity: 'UNCOMMON',
          isEquipped: true,
          version: 1,
        }),
      ],
    });

    await service.unequipItem(USER_ID_1, {
      itemId: RING_ID,
      expectedVersion: 1,
      inventoryVersion: 1,
    });

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.UNEQUIP_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it.each([
    ['WEAPON', 3, { atk: -3 }],
    ['ARMOR', 2, { def: -2 }],
    ['HELMET', 4, { def: -4 }],
    ['RING', 5, { luck: -5 }],
  ] as const)(
    'unequip: 강화 레벨이 로그 statsDelta에 포함되어야 한다 (%s)',
    async (slot, enhancementLevel, expectedStats) => {
      const { service, getDungeonLogs, statsCacheMock, prismaMock } =
        createPrismaMock({
          dungeonState: baseDungeonState,
          items: [
            createItem({
              id: SWORD_ID,
              code: 'weapon-longsword',
              slot,
              rarity: 'RARE',
              modifiers: [],
              isEquipped: true,
              enhancementLevel,
              version: 1,
            }),
          ],
        });

      await service.unequipItem(USER_ID_1, {
        itemId: SWORD_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(statsCacheMock).toHaveBeenCalledWith(USER_ID_1, prismaMock, {
        forceRefresh: true,
      });

      const logs = getDungeonLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0] as {
        action: string;
        delta?: { type?: string; detail?: { stats?: unknown } };
      };
      expect(log.action).toBe(DungeonLogAction.UNEQUIP_ITEM);
      expect(log.delta).toMatchObject({
        type: 'UNEQUIP_ITEM',
        detail: { stats: expectedStats },
      });
    },
  );

  it('discard: 장착 상태여도 삭제하고 버전을 증가시키며 로그를 남긴다', async () => {
    const { service, getItems, getDungeonLogs, statsCacheMock, prismaMock } =
      createPrismaMock({
        dungeonState: baseDungeonState,
        items: [
          createItem({
            id: RING_ID,
            code: 'ring-topaz',
            slot: 'RING',
            rarity: 'UNCOMMON',
            isEquipped: true,
            version: 4,
          }),
          createItem({
            id: POTION_ID,
            code: 'potion-healing',
            slot: 'CONSUMABLE',
            rarity: 'COMMON',
            version: 2,
          }),
        ],
      });

    const response = await service.discardItem(USER_ID_1, {
      itemId: RING_ID,
      expectedVersion: 4,
      inventoryVersion: 4,
    });

    expect(statsCacheMock).toHaveBeenCalledWith(USER_ID_1, prismaMock, {
      forceRefresh: true,
    });

    expect(response.items.find((item) => item.id === RING_ID)).toBeUndefined();
    expect(response.version).toBeGreaterThanOrEqual(5);

    expect(getItems().some((item) => item.id === RING_ID)).toBe(false);

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.DISCARD_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it('discard: quantity가 남아있으면 수량을 감소시키고 버전을 증가시킨다', async () => {
    const { service, getItems, getDungeonLogs } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: POTION_ID,
          code: 'potion-healing',
          slot: 'CONSUMABLE',
          rarity: 'COMMON',
          version: 3,
          quantity: 5,
        }),
      ],
    });

    const response = await service.discardItem(USER_ID_1, {
      itemId: POTION_ID,
      expectedVersion: 3,
      inventoryVersion: 3,
      quantity: 2,
    });

    const item = getItems().find(
      (inventoryItem) => inventoryItem.id === POTION_ID,
    );
    expect(item?.quantity).toBe(3);
    expect(item?.version).toBe(4);

    const responseItem = response.items.find(
      (inventoryItem) => inventoryItem.id === POTION_ID,
    );
    expect(responseItem?.quantity).toBe(3);

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.DISCARD_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it('discard: quantity가 현재 수량보다 크면 400을 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: POTION_ID,
          code: 'potion-healing',
          slot: 'CONSUMABLE',
          rarity: 'COMMON',
          version: 2,
          quantity: 3,
        }),
      ],
    });

    await expect(
      service.discardItem(USER_ID_1, {
        itemId: POTION_ID,
        expectedVersion: 2,
        inventoryVersion: 2,
        quantity: 4,
      }),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { code: 'INVENTORY_INVALID_REQUEST' },
    });
  });

  it('inventoryVersion 불일치 시 412를 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: RING_ID,
          code: 'ring-topaz',
          slot: 'RING',
          rarity: 'UNCOMMON',
          isEquipped: true,
          version: 5,
        }),
      ],
    });

    await expect(
      service.discardItem(USER_ID_1, {
        itemId: RING_ID,
        expectedVersion: 5,
        inventoryVersion: 4,
      }),
    ).rejects.toMatchObject({
      constructor: PreconditionFailedException,
      response: { code: 'INVENTORY_VERSION_MISMATCH' },
    });
  });

  it('dismantle: 장착 중이면 409를 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: RING_ID,
          code: 'ring-topaz',
          slot: 'RING',
          rarity: 'UNCOMMON',
          isEquipped: true,
          version: 2,
        }),
      ],
    });

    await expect(
      service.dismantleItem(USER_ID_1, {
        itemId: RING_ID,
        expectedVersion: 2,
        inventoryVersion: 2,
      }),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: { code: 'INVENTORY_SLOT_CONFLICT' },
    });
  });

  it('dismantle: 재료를 추가하고 로그를 남긴다', async () => {
    const { service, getItems, getDungeonLogs } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          rarity: 'RARE',
          isEquipped: false,
          version: 3,
        }),
      ],
    });

    const response = await service.dismantleItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 3,
      inventoryVersion: 3,
    });

    expect(response.items.find((item) => item.id === SWORD_ID)).toBeUndefined();
    expect(getItems().some((item) => item.id === SWORD_ID)).toBe(false);

    const material = response.items.find(
      (item) => item.code === 'material-metal-scrap',
    );
    expect(material?.quantity).toBe(3);

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.DISMANTLE_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it('dismantle: 강화 레벨 환급을 포함해 재료를 지급한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          rarity: 'RARE',
          enhancementLevel: 3,
          isEquipped: false,
          version: 1,
        }),
      ],
    });

    loadCatalogDataMock.mockResolvedValue({
      ...buildCatalog(),
      dismantle: {
        ...buildCatalog().dismantle,
        refundByEnhancementLevel: {
          ...buildCatalog().dismantle.refundByEnhancementLevel,
          // 카탈로그를 SSOT로 사용한다는 것을 검증하기 위해, 공식과 다른 값을 넣는다.
          '3': 100,
        },
      },
    });

    const response = await service.dismantleItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 1,
      inventoryVersion: 1,
    });

    const material = response.items.find(
      (item) => item.code === 'material-metal-scrap',
    );
    // rare 기본(3) + refund(100) = 103
    expect(material?.quantity).toBe(103);
  });

  it('enhance: 성공 시 레벨이 증가하고 자원이 차감된다', async () => {
    loadCatalogDataMock.mockResolvedValue(buildCatalog());
    const {
      service,
      getItems,
      getDungeonLogs,
      getDungeonState,
      statsCacheMock,
      prismaMock,
    } = createPrismaMock({
      dungeonState: { ...baseDungeonState, gold: 100 },
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          isEquipped: true,
          enhancementLevel: 0,
          version: 1,
        }),
        createItem({
          id: 'mat-1',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
        createItem({
          id: 'mat-2',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
      ],
      rngNext: 0.1,
    });

    const response = await service.enhanceItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 1,
      inventoryVersion: 1,
    });

    expect(response.version).toBe(2);
    const enhanced = response.items.find((item) => item.id === SWORD_ID);
    expect(enhanced?.enhancementLevel).toBe(1);
    expect(
      response.items.some((item) => item.code === 'material-metal-scrap'),
    ).toBe(false);
    expect(getItems().some((item) => item.id === 'mat-1')).toBe(false);
    expect(getDungeonState().gold).toBe(90);
    expect(statsCacheMock).toHaveBeenCalledWith(USER_ID_1, prismaMock, {
      forceRefresh: true,
    });

    const logs = getDungeonLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: DungeonLogAction.ENHANCE_ITEM,
        category: DungeonLogCategory.STATUS,
      }),
    );
  });

  it('enhance: 실패 시 레벨 유지 및 자원 차감', async () => {
    loadCatalogDataMock.mockResolvedValue(buildCatalog());
    const { service, getItems, getDungeonState } = createPrismaMock({
      dungeonState: { ...baseDungeonState, gold: 100 },
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          enhancementLevel: 0,
          version: 1,
        }),
        createItem({
          id: 'mat-1',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
        createItem({
          id: 'mat-2',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
      ],
      rngNext: 0.9,
    });

    const response = await service.enhanceItem(USER_ID_1, {
      itemId: SWORD_ID,
      expectedVersion: 1,
      inventoryVersion: 1,
    });

    const enhanced = response.items.find((item) => item.id === SWORD_ID);
    expect(enhanced?.enhancementLevel).toBe(0);
    expect(getItems().some((item) => item.id === 'mat-1')).toBe(false);
    expect(getDungeonState().gold).toBe(90);
  });

  it('enhance: 골드가 부족하면 400을 던져야 한다', async () => {
    loadCatalogDataMock.mockResolvedValue(buildCatalog());
    const { service } = createPrismaMock({
      dungeonState: { ...baseDungeonState, gold: 5 },
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          enhancementLevel: 0,
          version: 1,
        }),
        createItem({
          id: 'mat-1',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
        createItem({
          id: 'mat-2',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
      ],
    });

    await expect(
      service.enhanceItem(USER_ID_1, {
        itemId: SWORD_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      }),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { code: 'INVENTORY_INSUFFICIENT_GOLD' },
    });
  });

  it('enhance: 재료가 부족하면 400을 던져야 한다', async () => {
    loadCatalogDataMock.mockResolvedValue(buildCatalog());
    const { service } = createPrismaMock({
      dungeonState: { ...baseDungeonState, gold: 100 },
      items: [
        createItem({
          id: SWORD_ID,
          code: 'weapon-longsword',
          slot: 'WEAPON',
          enhancementLevel: 0,
          version: 1,
        }),
        createItem({
          id: 'mat-1',
          code: 'material-metal-scrap',
          slot: 'MATERIAL',
          rarity: 'COMMON',
          quantity: 1,
          version: 1,
        }),
      ],
    });

    await expect(
      service.enhanceItem(USER_ID_1, {
        itemId: SWORD_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      }),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { code: 'INVENTORY_INSUFFICIENT_MATERIALS' },
    });
  });

  it('다른 사용자의 아이템이면 404를 던져야 한다', async () => {
    const { service } = createPrismaMock({
      dungeonState: baseDungeonState,
      items: [
        createItem({
          id: RING_ID,
          userId: USER_ID_2,
          code: 'ring-topaz',
          slot: 'RING',
          rarity: 'UNCOMMON',
          isEquipped: true,
          version: 1,
        }),
      ],
    });

    await expect(
      service.equipItem(USER_ID_1, {
        itemId: RING_ID,
        expectedVersion: 1,
        inventoryVersion: 1,
      }),
    ).rejects.toMatchObject({
      constructor: NotFoundException,
      response: { code: 'INVENTORY_ITEM_NOT_FOUND' },
    });
  });
});
