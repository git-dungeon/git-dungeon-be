import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DungeonState, Prisma } from '@prisma/client';
import { ChestService } from './chest.service';
import type { SeededRandomFactory } from '../dungeon/events/seeded-rng.provider';
import type { DropService } from '../dungeon/drops/drop.service';
import type { DropInventoryService } from '../dungeon/drops/drop-inventory.service';

const createState = (overrides: Partial<DungeonState> = {}) => ({
  userId: '00000000-0000-4000-8000-000000000777',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 1,
  luck: 1,
  levelUpPoints: 0,
  levelUpRollIndex: 0,
  unopenedChests: 1,
  chestRollIndex: 0,
  equipmentBonus: null,
  statsVersion: 0,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 10,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  version: 1,
  ...overrides,
});

describe('ChestService', () => {
  it('상자가 없으면 409를 반환한다', async () => {
    const prisma = {
      dungeonState: {
        findUnique: vi
          .fn()
          .mockResolvedValue(createState({ unopenedChests: 0 })),
      },
    } as unknown as Prisma.TransactionClient & {
      dungeonState: { findUnique: ReturnType<typeof vi.fn> };
    };

    const service = new ChestService(
      prisma as never,
      { create: vi.fn() } as unknown as SeededRandomFactory,
      { roll: vi.fn() } as unknown as DropService,
      { applyDrops: vi.fn() } as unknown as DropInventoryService,
    );

    await expect(service.open('user')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('사용자 상태가 없으면 401을 반환한다', async () => {
    const prisma = {
      dungeonState: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Prisma.TransactionClient & {
      dungeonState: { findUnique: ReturnType<typeof vi.fn> };
    };

    const service = new ChestService(
      prisma as never,
      { create: vi.fn() } as unknown as SeededRandomFactory,
      { roll: vi.fn() } as unknown as DropService,
      { applyDrops: vi.fn() } as unknown as DropInventoryService,
    );

    await expect(service.open('user')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('상자 열기 성공 시 인벤토리/로그를 기록한다', async () => {
    const state = createState({ unopenedChests: 2, chestRollIndex: 3 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createLog = vi.fn().mockResolvedValue({});

    const prisma = {
      dungeonState: {
        findUnique: vi.fn().mockResolvedValue(state),
        updateMany,
      },
      dungeonLog: {
        create: createLog,
      },
      $transaction: vi.fn(
        async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          fn({
            dungeonState: { updateMany },
            dungeonLog: { create: createLog },
          } as unknown as Prisma.TransactionClient),
      ),
    } as unknown as Prisma.TransactionClient & {
      dungeonState: {
        findUnique: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
      dungeonLog: { create: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };

    const dropService = {
      roll: vi
        .fn()
        .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
    };
    const dropInventoryService = {
      applyDrops: vi.fn().mockResolvedValue([
        {
          itemId: '00000000-0000-4000-8000-000000000888',
          code: 'weapon-wooden-sword',
          slot: 'weapon',
          rarity: 'common',
          quantity: 1,
        },
      ]),
    };
    const rngFactory = {
      create: vi.fn().mockReturnValue({ next: () => 0.1 }),
    } as unknown as SeededRandomFactory;

    const service = new ChestService(
      prisma as never,
      rngFactory,
      dropService as unknown as DropService,
      dropInventoryService as unknown as DropInventoryService,
    );

    const result = await service.open(state.userId);

    expect(result.remainingChests).toBe(1);
    expect(result.rollIndex).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(dropService.roll).toHaveBeenCalled();
    expect(dropInventoryService.applyDrops).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: state.userId, version: state.version },
      data: {
        unopenedChests: 1,
        chestRollIndex: 4,
        version: 2,
      },
    });
    expect(createLog).toHaveBeenCalled();
  });
});
