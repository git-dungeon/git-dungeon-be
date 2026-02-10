import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChestOpenResponse } from './dto/chest-response.dto';
import {
  SEEDED_RNG_FACTORY,
  type SeededRandomFactory,
} from '../dungeon/events/seeded-rng.provider';
import {
  DEFAULT_DROP_TABLE_ID,
  DropService,
} from '../dungeon/drops/drop.service';
import { DropInventoryService } from '../dungeon/drops/drop-inventory.service';
import type { DungeonLogDelta } from '../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../common/logs/dungeon-log-extra';
import type {
  InventoryRarity,
  InventorySlot,
} from '../inventory/dto/inventory-response.dto';

@Injectable()
export class ChestService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEEDED_RNG_FACTORY)
    private readonly rngFactory: SeededRandomFactory,
    private readonly dropService: DropService,
    private readonly dropInventoryService: DropInventoryService,
  ) {}

  async open(userId: string): Promise<ChestOpenResponse> {
    const state = await this.prisma.dungeonState.findUnique({
      where: { userId },
    });

    if (!state) {
      throw new UnauthorizedException({
        code: 'CHEST_UNAUTHORIZED',
        message: '상자 정보를 조회할 수 없습니다.',
      });
    }

    if (state.unopenedChests <= 0) {
      throw new ConflictException({
        code: 'CHEST_EMPTY',
        message: '열 수 있는 상자가 없습니다.',
      });
    }

    const rollIndex = state.chestRollIndex;
    const seed = `${userId}:chest:${rollIndex}`;
    const rng = this.rngFactory.create(seed);
    const drops = this.dropService.roll({ rng, isElite: false });

    if (!drops.length) {
      throw new InternalServerErrorException({
        code: 'CHEST_ROLL_EMPTY',
        message: '상자 보상을 확정할 수 없습니다.',
      });
    }

    const remainingChests = state.unopenedChests - 1;
    const nextRollIndex = rollIndex + 1;
    const nextVersion = state.version + 1;

    const items = await this.prisma.$transaction(async (tx) => {
      const added = await this.dropInventoryService.applyDrops(
        {
          userId,
          drops,
        },
        tx,
      );

      const updated = await tx.dungeonState.updateMany({
        where: { userId, version: state.version },
        data: {
          unopenedChests: remainingChests,
          chestRollIndex: nextRollIndex,
          version: nextVersion,
        },
      });

      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'CHEST_STATE_CONFLICT',
          message: '상자 상태가 변경되었습니다. 다시 시도해주세요.',
        });
      }

      const delta: DungeonLogDelta = {
        type: 'ACQUIRE_ITEM',
        detail: {
          inventory: {
            added,
          },
        },
      };

      const extra: DungeonLogDetails = {
        type: 'ACQUIRE_ITEM',
        details: {
          reward: {
            source: 'CHEST',
            drop: {
              tableId: DEFAULT_DROP_TABLE_ID,
              isElite: false,
              items: drops.map((drop) => ({
                code: drop.code,
                quantity: drop.quantity,
              })),
            },
          },
        },
      };

      await tx.dungeonLog.create({
        data: {
          userId,
          category: DungeonLogCategory.STATUS,
          action: DungeonLogAction.ACQUIRE_ITEM,
          status: DungeonLogStatus.COMPLETED,
          floor: state.floor ?? null,
          turnNumber: null,
          stateVersionBefore: state.version,
          stateVersionAfter: nextVersion,
          delta: delta as Prisma.InputJsonValue,
          extra: extra as Prisma.InputJsonValue,
          createdAt: new Date(),
        },
      });

      return added;
    });

    const responseItems: ChestOpenResponse['items'] = items.map((item) => ({
      itemId: item.itemId,
      code: item.code,
      slot: item.slot as InventorySlot,
      rarity: (item.rarity ?? 'common') as InventoryRarity,
      quantity: item.quantity ?? 1,
    }));

    return {
      remainingChests,
      rollIndex,
      items: responseItems,
    };
  }
}
