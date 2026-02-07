/// <reference types="vitest" />
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { createDashboardStateResponse } from '../test-support/fixtures';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
  const INVENTORY_ITEM_ID_1 = '11111111-1111-4111-8111-111111111111';

  const prismaMock = {
    dungeonState: {
      findUnique: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
    },
  };

  const service = new DashboardService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.dungeonState.findUnique.mockReset();
    prismaMock.inventoryItem.findMany.mockReset();
  });

  it('대시보드 상태를 반환해야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      level: 5,
      exp: 120,
      levelUpPoints: 0,
      unopenedChests: 0,
      hp: 100,
      maxHp: 120,
      atk: 25,
      def: 10,
      luck: 7,
      floor: 3,
      maxFloor: 10,
      floorProgress: 50,
      gold: 500,
      ap: 8,
      currentAction: 'idle',
      currentActionStartedAt: new Date('2025-10-27T07:00:00.000Z'),
      createdAt: new Date('2025-10-27T06:00:00.000Z'),
      updatedAt: new Date('2025-10-27T07:00:00.000Z'),
      version: 1,
    });

    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: INVENTORY_ITEM_ID_1,
        code: 'SWORD_1',
        slot: 'WEAPON',
        rarity: 'COMMON',
        modifiers: [],
        isEquipped: true,
        obtainedAt: new Date('2025-10-26T12:00:00.000Z'),
        version: 1,
      },
    ]);

    const result = await service.getState(USER_ID_1);

    expect(result).toEqual(createDashboardStateResponse());
  });

  it('강화 레벨이 스탯(equipmentBonus)에 반영되어야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      level: 5,
      exp: 120,
      levelUpPoints: 0,
      unopenedChests: 0,
      hp: 100,
      maxHp: 120,
      atk: 25,
      def: 10,
      luck: 7,
      floor: 3,
      maxFloor: 10,
      floorProgress: 50,
      gold: 500,
      ap: 8,
      currentAction: 'idle',
      currentActionStartedAt: new Date('2025-10-27T07:00:00.000Z'),
      createdAt: new Date('2025-10-27T06:00:00.000Z'),
      updatedAt: new Date('2025-10-27T07:00:00.000Z'),
      version: 1,
    });

    prismaMock.inventoryItem.findMany.mockResolvedValue([
      {
        id: INVENTORY_ITEM_ID_1,
        code: 'SWORD_1',
        slot: 'WEAPON',
        rarity: 'COMMON',
        modifiers: [],
        enhancementLevel: 3,
        isEquipped: true,
        obtainedAt: new Date('2025-10-26T12:00:00.000Z'),
        version: 1,
      },
    ]);

    const result = await service.getState(USER_ID_1);

    expect(result).toEqual(
      createDashboardStateResponse({
        atk: 28,
        stats: {
          base: { hp: 120, maxHp: 120, atk: 25, def: 10, luck: 7 },
          equipmentBonus: { hp: 0, maxHp: 0, atk: 3, def: 0, luck: 0 },
          total: { hp: 120, maxHp: 120, atk: 28, def: 10, luck: 7 },
        },
      }),
    );
  });

  it('레벨이 없으면 expToLevel이 null이어야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      level: 0,
      exp: 0,
      levelUpPoints: 0,
      unopenedChests: 0,
      hp: 10,
      maxHp: 10,
      atk: 1,
      def: 1,
      luck: 1,
      floor: 1,
      maxFloor: 1,
      floorProgress: 0,
      gold: 0,
      ap: 0,
      currentAction: null,
      currentActionStartedAt: null,
      createdAt: new Date('2025-10-27T06:00:00.000Z'),
      updatedAt: new Date('2025-10-27T07:00:00.000Z'),
      version: 1,
    });
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);

    const result = await service.getState(USER_ID_1);

    expect(result.state.expToLevel).toBeNull();
    expect(result.state.equippedItems).toEqual([]);
  });

  it('상태를 찾지 못하면 DASHBOARD_UNAUTHORIZED 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue(null);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);

    await expect(service.getState(USER_ID_1)).rejects.toMatchObject({
      constructor: UnauthorizedException,
      response: { code: 'DASHBOARD_UNAUTHORIZED' },
    });
  });

  it('응답 검증 실패 시 로깅 후 예외를 던져야 한다', async () => {
    prismaMock.dungeonState.findUnique.mockResolvedValue({
      userId: USER_ID_1,
      level: null,
      exp: 120,
      levelUpPoints: 0,
      unopenedChests: 0,
      hp: 100,
      maxHp: 120,
      atk: 25,
      def: 10,
      luck: 7,
      floor: 3,
      maxFloor: 10,
      floorProgress: 50,
      gold: 500,
      ap: 8,
      currentAction: 'idle',
      currentActionStartedAt: new Date('2025-10-27T07:00:00.000Z'),
      createdAt: new Date('2025-10-27T06:00:00.000Z'),
      updatedAt: new Date('2025-10-27T07:00:00.000Z'),
      version: 1,
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

    await expect(service.getState(USER_ID_1)).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: { code: 'DASHBOARD_STATE_INVALID_RESPONSE' },
    });

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    loggerSpy.mockRestore();
  });
});
