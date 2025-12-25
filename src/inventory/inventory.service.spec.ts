/// <reference types="vitest" />
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';
import { DungeonLogAction, DungeonLogCategory } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
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

describe('InventoryService', () => {
  const prismaMock = {
    dungeonState: {
      findUnique: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
    },
  };

  const service = new InventoryService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.dungeonState.findUnique.mockReset();
    prismaMock.inventoryItem.findMany.mockReset();
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

    const response = await service.getInventory(USER_ID_1);

    expect(response.items).toHaveLength(2);
    expect(response.version).toBe(3);
    expect(response.equipped.weapon?.id).toBe(ITEM_ID_WEAPON);
    expect(response.summary.base).toEqual({
      hp: 10,
      atk: 5,
      def: 3,
      luck: 1,
    });
    expect(response.summary.equipmentBonus).toEqual({
      hp: 0,
      atk: 5,
      def: 1,
      luck: 0,
    });
    expect(response.summary.total).toEqual({
      hp: 10,
      atk: 10,
      def: 4,
      luck: 1,
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

    const response = await service.getInventory(USER_ID_1);

    expect(response.version).toBe(0);
    expect(response.items).toEqual([]);
    expect(response.equipped).toEqual({});
    expect(response.summary.base).toEqual({ hp: 8, atk: 3, def: 2, luck: 1 });
    expect(response.summary.total).toEqual({ hp: 8, atk: 3, def: 2, luck: 1 });
    expect(response.summary.equipmentBonus).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      luck: 0,
    });
  });

  it('던전 상태가 없으면 INVENTORY_UNAUTHORIZED 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue(null);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);

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
      slot: 'WEAPON' | 'ARMOR' | 'HELMET' | 'RING' | 'CONSUMABLE';
      rarity: string;
      modifiers: unknown;
      isEquipped: boolean;
      obtainedAt: Date;
      version: number;
    }>,
  ) => ({
    id: ITEM_ID_GENERIC,
    userId: USER_ID_1,
    code: 'weapon-longsword',
    slot: 'WEAPON' as const,
    rarity: 'RARE',
    modifiers: [],
    isEquipped: false,
    obtainedAt: new Date('2025-10-30T09:00:00.000Z'),
    version: 1,
    ...overrides,
  });

  const createPrismaMock = ({
    dungeonState,
    items,
  }: {
    dungeonState: {
      userId: string;
      hp: number;
      atk: number;
      def: number;
      luck: number;
    };
    items: Array<{
      id: string;
      userId: string;
      code: string;
      slot: 'WEAPON' | 'ARMOR' | 'HELMET' | 'RING' | 'CONSUMABLE';
      rarity: string;
      modifiers: unknown;
      isEquipped: boolean;
      obtainedAt: Date;
      version: number;
    }>;
  }) => {
    let inventoryItems = [...items];
    const dungeonLogCreates: unknown[] = [];
    const prismaMock = {
      dungeonState: {
        findUnique: vi.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve(
            where.userId === dungeonState.userId ? dungeonState : null,
          ),
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
        findMany: vi.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve(
            inventoryItems
              .filter((item) => item.userId === where.userId)
              .sort((a, b) => a.obtainedAt.getTime() - b.obtainedAt.getTime()),
          ),
        ),
        updateMany: vi.fn(
          ({
            where,
            data,
          }: {
            where: { id: string; userId: string; version: number };
            data: { isEquipped?: boolean; version?: { increment: number } };
          }) => {
            let count = 0;
            inventoryItems = inventoryItems.map((item) => {
              if (
                item.id === where.id &&
                item.userId === where.userId &&
                item.version === where.version
              ) {
                count += 1;
                return {
                  ...item,
                  ...(data.isEquipped !== undefined
                    ? { isEquipped: data.isEquipped }
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
        deleteMany: vi.fn(
          ({
            where,
          }: {
            where: { id: string; userId: string; version: number };
          }) => {
            const before = inventoryItems.length;
            inventoryItems = inventoryItems.filter(
              (item) =>
                !(
                  item.id === where.id &&
                  item.userId === where.userId &&
                  item.version === where.version
                ),
            );
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

    return {
      service: new InventoryService(prismaMock as unknown as PrismaService),
      prismaMock,
      getItems: () => inventoryItems,
      getDungeonLogs: () => dungeonLogCreates,
    };
  };

  const baseDungeonState = {
    userId: USER_ID_1,
    hp: 8,
    atk: 3,
    def: 2,
    luck: 1,
  };

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

  it('discard: 장착 상태여도 삭제하고 버전을 증가시키며 로그를 남긴다', async () => {
    const { service, getItems, getDungeonLogs } = createPrismaMock({
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
