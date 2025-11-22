/// <reference types="vitest" />
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import {
  resetTypiaAssertMock,
  typiaAssertMock,
} from '../test-support/mocks/typia';
import { MockTypeGuardError } from '../test-support/mocks/typia';

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
      userId: 'user-1',
      hp: 10,
      atk: 5,
      def: 3,
      luck: 1,
    });

    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-weapon',
        userId: 'user-1',
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
        id: 'item-backpack',
        userId: 'user-1',
        code: 'consumable-slot',
        slot: 'CONSUMABLE',
        rarity: 'COMMON',
        modifiers: [],
        isEquipped: false,
        obtainedAt: new Date('2025-10-30T10:00:00.000Z'),
        version: 1,
      },
    ]);

    const response = await service.getInventory('user-1');

    expect(response.items).toHaveLength(2);
    expect(response.version).toBe(3);
    expect(response.equipped.weapon?.id).toBe('item-weapon');
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
      userId: 'user-1',
      hp: 8,
      atk: 3,
      def: 2,
      luck: 1,
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);

    const response = await service.getInventory('user-1');

    expect(response.version).toBe(0);
    expect(response.items).toEqual([]);
    expect(response.equipped).toEqual({});
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

    await expect(service.getInventory('user-1')).rejects.toMatchObject({
      constructor: UnauthorizedException,
      response: { code: 'INVENTORY_UNAUTHORIZED' },
    });
  });

  it('typia 검증 실패 시 로깅 후 INVENTORY_INVALID_RESPONSE 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: 'user-1',
      hp: 10,
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

    typiaAssertMock.mockImplementationOnce(() => {
      throw new MockTypeGuardError('items', 'InventoryResponse', null);
    });

    await expect(service.getInventory('user-1')).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: { code: 'INVENTORY_INVALID_RESPONSE' },
    });

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    loggerSpy.mockRestore();
  });
});
