import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StatsCacheService } from './stats-cache.service';
import { loadCatalogData } from '../../catalog';
import type { PrismaService } from '../../prisma/prisma.service';

vi.mock('../../catalog', () => ({
  loadCatalogData: vi.fn(),
}));

describe('StatsCacheService', () => {
  const prismaMock = {
    dungeonState: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  const loadCatalogDataMock = vi.mocked(loadCatalogData);

  const service = new StatsCacheService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.dungeonState.findUnique.mockReset();
    prismaMock.dungeonState.update.mockReset();
    prismaMock.inventoryItem.findMany.mockReset();
    prismaMock.inventoryItem.update.mockReset();
    loadCatalogDataMock.mockReset();
  });

  const baseState = {
    userId: '00000000-0000-4000-8000-000000000001',
    maxHp: 100,
    atk: 10,
    def: 10,
    luck: 10,
  };

  const buildCatalog = (version: number) => ({
    version,
    updatedAt: '2026-01-21T00:00:00.000Z',
    items: [],
    buffs: [],
    monsters: [],
    dropTables: [],
  });

  it('버전이 같고 캐시된 보너스가 유효하면 업데이트 없이 반환한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      ...baseState,
      statsVersion: 2,
      equipmentBonus: {
        hp: 1,
        maxHp: 1,
        atk: 1,
        def: 1,
        luck: 1,
      },
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        code: 'weapon-longsword',
        modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 1 }],
        modifierVersion: 2,
      },
    ]);
    loadCatalogDataMock.mockResolvedValue(buildCatalog(2));

    const result = await service.ensureStatsCache(baseState.userId);

    expect(result).toEqual({
      hp: 1,
      maxHp: 1,
      atk: 1,
      def: 1,
      luck: 1,
    });
    expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled();
    expect(prismaMock.dungeonState.update).not.toHaveBeenCalled();
  });

  it('버전이 다르면 modifiers와 equipmentBonus를 갱신한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      ...baseState,
      statsVersion: 4,
      equipmentBonus: {
        hp: 0,
        maxHp: 0,
        atk: 0,
        def: 0,
        luck: 0,
      },
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        code: 'weapon-longsword',
        modifiers: [],
        modifierVersion: 4,
      },
      {
        id: 'item-2',
        code: 'armor-chain',
        modifiers: [{ kind: 'stat', stat: 'def', mode: 'percent', value: 0.1 }],
        modifierVersion: 4,
      },
    ]);
    loadCatalogDataMock.mockResolvedValue({
      ...buildCatalog(5),
      items: [
        {
          code: 'weapon-longsword',
          nameKey: 'item.weapon-longsword',
          name: 'Longsword',
          slot: 'weapon',
          rarity: 'common',
          modifiers: [
            { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
            { kind: 'stat', stat: 'atk', mode: 'percent', value: 0.1 },
          ],
          spriteId: 'weapon-longsword',
        },
        {
          code: 'armor-chain',
          nameKey: 'item.armor-chain',
          name: 'Chain Armor',
          slot: 'armor',
          rarity: 'common',
          modifiers: [
            { kind: 'stat', stat: 'def', mode: 'percent', value: 0.2 },
          ],
          spriteId: 'armor-chain',
        },
      ],
    });

    const result = await service.ensureStatsCache(baseState.userId);

    expect(result).toEqual({
      hp: 0,
      maxHp: 0,
      atk: 6,
      def: 2,
      luck: 0,
    });
    expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: {
          modifiers: [
            { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
            { kind: 'stat', stat: 'atk', mode: 'percent', value: 0.1 },
          ],
          modifierVersion: 5,
        },
      }),
    );
    expect(prismaMock.dungeonState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseState.userId },
        data: {
          equipmentBonus: {
            hp: 0,
            maxHp: 0,
            atk: 6,
            def: 2,
            luck: 0,
          },
          statsVersion: 5,
        },
      }),
    );
  });

  it('캐시된 보너스가 없으면 버전이 같아도 갱신한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      ...baseState,
      statsVersion: 3,
      equipmentBonus: null,
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        code: 'weapon-longsword',
        modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 2 }],
        modifierVersion: 3,
      },
    ]);
    loadCatalogDataMock.mockResolvedValue({
      ...buildCatalog(3),
      items: [
        {
          code: 'weapon-longsword',
          nameKey: 'item.weapon-longsword',
          name: 'Longsword',
          slot: 'weapon',
          rarity: 'common',
          modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 2 }],
          spriteId: 'weapon-longsword',
        },
      ],
    });

    const result = await service.ensureStatsCache(baseState.userId);

    expect(result).toEqual({
      hp: 0,
      maxHp: 0,
      atk: 2,
      def: 0,
      luck: 0,
    });
    expect(prismaMock.dungeonState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseState.userId },
        data: {
          equipmentBonus: {
            hp: 0,
            maxHp: 0,
            atk: 2,
            def: 0,
            luck: 0,
          },
          statsVersion: 3,
        },
      }),
    );
  });

  it('던전 상태가 없으면 예외를 던진다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue(null);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    loadCatalogDataMock.mockResolvedValue(buildCatalog(1));

    await expect(
      service.ensureStatsCache(baseState.userId),
    ).rejects.toMatchObject({
      constructor: UnauthorizedException,
      response: { code: 'INVENTORY_UNAUTHORIZED' },
    });
  });
});
