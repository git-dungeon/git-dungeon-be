import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  Prisma,
  type InventoryItem,
} from '@prisma/client';
import typia, { TypeGuardError } from 'typia';
import { parseInventoryModifiers } from '../common/inventory/inventory-modifier';
import { addEquipmentStats } from '../common/inventory/equipment-stats';
import {
  extractFlatStatModifiers,
  calculateStatsDiff,
  isEmptyStatsDelta,
} from '../common/stats/stat-delta.util';
import { PrismaService } from '../prisma/prisma.service';
import type {
  EquipmentItem,
  EquipmentStats,
  EquippedItems,
  InventoryResponse,
  InventoryRarity,
  InventorySlot,
} from './dto/inventory.response';
import type { DungeonLogDelta } from '../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../common/logs/dungeon-log-extra';
import { StatsCacheService } from '../common/stats/stats-cache.service';

type InventoryLogAction = 'EQUIP_ITEM' | 'UNEQUIP_ITEM' | 'DISCARD_ITEM';

const INVENTORY_SLOTS: InventorySlot[] = [
  'helmet',
  'armor',
  'weapon',
  'ring',
  'consumable',
];

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statsCacheService: StatsCacheService,
  ) {}

  async getInventory(userId: string): Promise<InventoryResponse> {
    const response = await this.buildInventoryResponse(this.prisma, userId);

    return this.assertInventoryResponse(userId, response);
  }

  async equipItem(
    userId: string,
    payload: {
      itemId: string;
      expectedVersion: number;
      inventoryVersion: number;
    },
  ): Promise<InventoryResponse> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.inventoryItem.findUnique({
        where: { id: payload.itemId },
      });

      this.assertOwnedItem(target, userId);
      this.assertItemVersion(target, payload.expectedVersion);
      const currentInventoryVersion = await this.assertInventoryVersion(
        tx,
        userId,
        payload.inventoryVersion,
      );

      if (target.isEquipped) {
        throw new ConflictException({
          code: 'INVENTORY_SLOT_CONFLICT',
          message: '이미 장착된 아이템입니다.',
        });
      }

      const equippedInSlot = await tx.inventoryItem.findFirst({
        where: { userId, slot: target.slot, isEquipped: true },
      });

      if (equippedInSlot) {
        await this.unequipExistingItem(tx, equippedInSlot);
      }

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: target.id,
          userId,
          version: payload.expectedVersion,
        },
        data: { isEquipped: true, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'INVENTORY_VERSION_MISMATCH',
          message: '아이템 버전이 일치하지 않습니다.',
        });
      }

      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.EQUIP_ITEM,
        item: this.mapInventoryItem(target),
        replaced: equippedInSlot
          ? this.mapInventoryItem(equippedInSlot)
          : undefined,
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: currentInventoryVersion + 1,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  async unequipItem(
    userId: string,
    payload: {
      itemId: string;
      expectedVersion: number;
      inventoryVersion: number;
    },
  ): Promise<InventoryResponse> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.inventoryItem.findUnique({
        where: { id: payload.itemId },
      });

      this.assertOwnedItem(target, userId);
      this.assertItemVersion(target, payload.expectedVersion);
      const currentInventoryVersion = await this.assertInventoryVersion(
        tx,
        userId,
        payload.inventoryVersion,
      );

      if (!target.isEquipped) {
        throw new ConflictException({
          code: 'INVENTORY_SLOT_CONFLICT',
          message: '장착 상태가 아닙니다.',
        });
      }

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: target.id,
          userId,
          version: payload.expectedVersion,
        },
        data: { isEquipped: false, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'INVENTORY_VERSION_MISMATCH',
          message: '아이템 버전이 일치하지 않습니다.',
        });
      }

      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.UNEQUIP_ITEM,
        item: this.mapInventoryItem(target),
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: currentInventoryVersion + 1,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  async discardItem(
    userId: string,
    payload: {
      itemId: string;
      expectedVersion: number;
      inventoryVersion: number;
    },
  ): Promise<InventoryResponse> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.inventoryItem.findUnique({
        where: { id: payload.itemId },
      });

      this.assertOwnedItem(target, userId);
      this.assertItemVersion(target, payload.expectedVersion);
      const currentInventoryVersion = await this.assertInventoryVersion(
        tx,
        userId,
        payload.inventoryVersion,
      );

      const deleted = await tx.inventoryItem.deleteMany({
        where: {
          id: target.id,
          userId,
          version: payload.expectedVersion,
        },
      });

      if (deleted.count === 0) {
        throw new PreconditionFailedException({
          code: 'INVENTORY_VERSION_MISMATCH',
          message: '아이템 버전이 일치하지 않습니다.',
        });
      }

      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.DISCARD_ITEM,
        item: this.mapInventoryItem(target),
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: currentInventoryVersion + 1,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  private async buildInventoryResponse(
    prismaClient: PrismaService | Prisma.TransactionClient,
    userId: string,
    options?: { forcedInventoryVersion?: number },
  ): Promise<InventoryResponse> {
    const equipmentBonus = await this.statsCacheService.ensureStatsCache(
      userId,
      prismaClient,
    );
    const [dungeonState, inventoryItems] = await Promise.all([
      prismaClient.dungeonState.findUnique({ where: { userId } }),
      prismaClient.inventoryItem.findMany({
        where: { userId },
        orderBy: { obtainedAt: 'asc' },
      }),
    ]);

    if (!dungeonState) {
      throw new UnauthorizedException({
        code: 'INVENTORY_UNAUTHORIZED',
        message: '인벤토리를 조회할 수 없습니다.',
      });
    }

    const items = inventoryItems.map((item) => this.mapInventoryItem(item));
    const equipped = this.mapEquipped(items);
    const baseStats = this.getBaseStats(dungeonState);
    const summary = {
      base: baseStats,
      equipmentBonus,
      total: addEquipmentStats(baseStats, equipmentBonus),
    };

    const version =
      inventoryItems.length === 0
        ? 0
        : Math.max(...inventoryItems.map((item) => item.version ?? 0));
    const resolvedVersion =
      options?.forcedInventoryVersion !== undefined
        ? Math.max(version, options.forcedInventoryVersion)
        : version;

    return {
      version: resolvedVersion,
      items,
      equipped,
      summary,
    };
  }

  private assertInventoryResponse(
    userId: string,
    response: InventoryResponse,
  ): InventoryResponse {
    try {
      return typia.assert<InventoryResponse>(response);
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error(
          'InventoryResponse validation failed',
          JSON.stringify({
            path: error.path,
            expected: error.expected,
            value: error.value,
            userId,
          }),
        );

        throw new InternalServerErrorException({
          code: 'INVENTORY_INVALID_RESPONSE',
          message: '인벤토리 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
          },
        });
      }

      throw error;
    }
  }

  private async assertInventoryVersion(
    prismaClient: PrismaService | Prisma.TransactionClient,
    userId: string,
    expectedInventoryVersion: number,
  ): Promise<number> {
    const result = await prismaClient.inventoryItem.aggregate({
      where: { userId },
      _max: { version: true },
    });

    const currentInventoryVersion = result._max.version ?? 0;

    if (currentInventoryVersion !== expectedInventoryVersion) {
      throw new PreconditionFailedException({
        code: 'INVENTORY_VERSION_MISMATCH',
        message: '인벤토리 버전이 일치하지 않습니다.',
      });
    }

    return currentInventoryVersion;
  }

  private assertOwnedItem(
    item: InventoryItem | null,
    userId: string,
  ): asserts item is InventoryItem {
    if (!item || item.userId !== userId) {
      throw new NotFoundException({
        code: 'INVENTORY_ITEM_NOT_FOUND',
        message: '아이템을 찾을 수 없습니다.',
      });
    }
  }

  private assertItemVersion(
    item: InventoryItem,
    expectedVersion: number,
  ): void {
    if (item.version !== expectedVersion) {
      throw new PreconditionFailedException({
        code: 'INVENTORY_VERSION_MISMATCH',
        message: '아이템 버전이 일치하지 않습니다.',
      });
    }
  }

  private async unequipExistingItem(
    tx: Prisma.TransactionClient,
    item: InventoryItem,
  ): Promise<void> {
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, userId: item.userId, version: item.version },
      data: { isEquipped: false, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new PreconditionFailedException({
        code: 'INVENTORY_VERSION_MISMATCH',
        message: '슬롯 장착 상태를 업데이트할 수 없습니다.',
      });
    }
  }

  private mapInventoryItem(item: InventoryItem): EquipmentItem {
    const modifiers = parseInventoryModifiers(item.modifiers);
    const rarity = item.rarity.toLowerCase();

    return {
      id: item.id,
      code: item.code,
      name: null,
      slot: item.slot.toLowerCase() as InventorySlot,
      rarity: this.assertInventoryRarity(rarity),
      modifiers,
      effect: null,
      sprite: null,
      createdAt: item.obtainedAt.toISOString(),
      isEquipped: item.isEquipped,
      version: item.version,
    };
  }

  private assertInventoryRarity(rarity: string): InventoryRarity {
    if (
      rarity === 'common' ||
      rarity === 'uncommon' ||
      rarity === 'rare' ||
      rarity === 'epic' ||
      rarity === 'legendary'
    ) {
      return rarity;
    }

    throw new InternalServerErrorException({
      code: 'INVENTORY_INVALID_RESPONSE',
      message: '인벤토리 응답 스키마가 유효하지 않습니다.',
      details: {
        path: '$input.items[*].rarity',
        expected: 'InventoryRarity',
      },
    });
  }

  private mapEquipped(items: EquipmentItem[]): EquippedItems {
    return items.reduce<EquippedItems>((acc, item) => {
      if (item.isEquipped && this.isInventorySlot(item.slot)) {
        acc[item.slot] = item;
      }
      return acc;
    }, {} as EquippedItems);
  }

  private getBaseStats(dungeonState: {
    maxHp: number;
    atk: number;
    def: number;
    luck: number;
  }): EquipmentStats {
    return {
      hp: dungeonState.maxHp,
      maxHp: dungeonState.maxHp,
      atk: dungeonState.atk,
      def: dungeonState.def,
      luck: dungeonState.luck,
    };
  }

  private isInventorySlot(slot: string): slot is InventorySlot {
    return INVENTORY_SLOTS.includes(slot as InventorySlot);
  }

  private async appendInventoryLog(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      action: InventoryLogAction;
      item: EquipmentItem;
      replaced?: EquipmentItem;
    },
  ): Promise<void> {
    const delta: DungeonLogDelta = this.buildInventoryDelta(input);
    const extra: DungeonLogDetails = this.buildInventoryDetails(input);

    await tx.dungeonLog.create({
      data: {
        userId,
        category: DungeonLogCategory.STATUS,
        action: input.action,
        status: DungeonLogStatus.COMPLETED,
        floor: null,
        turnNumber: null,
        stateVersionBefore: null,
        stateVersionAfter: null,
        delta: delta as Prisma.InputJsonValue,
        extra: extra as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });
  }

  private buildInventoryDelta(input: {
    action: InventoryLogAction;
    item: EquipmentItem;
    replaced?: EquipmentItem;
  }): DungeonLogDelta {
    if (input.action === DungeonLogAction.EQUIP_ITEM) {
      const equipStats = extractFlatStatModifiers(input.item.modifiers);
      const unequipStats = input.replaced
        ? extractFlatStatModifiers(input.replaced.modifiers)
        : {};
      const statsDiff = calculateStatsDiff(equipStats, unequipStats);

      return {
        type: 'EQUIP_ITEM',
        detail: {
          inventory: {
            equipped: {
              slot: input.item.slot,
              itemId: input.item.id,
              code: input.item.code,
            },
            unequipped: input.replaced
              ? {
                  slot: input.replaced.slot,
                  itemId: input.replaced.id,
                  code: input.replaced.code,
                }
              : undefined,
          },
          stats: isEmptyStatsDelta(statsDiff) ? undefined : statsDiff,
        },
      };
    }

    if (input.action === DungeonLogAction.UNEQUIP_ITEM) {
      const unequipStats = extractFlatStatModifiers(input.item.modifiers);
      // 해제 시 스탯은 감소 (음수)
      const statsDiff: Record<string, number> = {};
      for (const [key, value] of Object.entries(unequipStats)) {
        if (value !== 0) {
          statsDiff[key] = -value;
        }
      }

      return {
        type: 'UNEQUIP_ITEM',
        detail: {
          inventory: {
            unequipped: {
              slot: input.item.slot,
              itemId: input.item.id,
              code: input.item.code,
            },
          },
          stats: Object.keys(statsDiff).length > 0 ? statsDiff : undefined,
        },
      };
    }

    return {
      type: 'DISCARD_ITEM',
      detail: {
        inventory: {
          removed: [
            {
              itemId: input.item.id,
              code: input.item.code,
            },
          ],
          unequipped: input.item.isEquipped
            ? {
                slot: input.item.slot,
                itemId: input.item.id,
                code: input.item.code,
              }
            : undefined,
        },
      },
    };
  }

  private buildInventoryDetails(input: {
    action: InventoryLogAction;
    item: EquipmentItem;
    replaced?: EquipmentItem;
  }): DungeonLogDetails {
    return {
      type:
        input.action === DungeonLogAction.EQUIP_ITEM
          ? 'EQUIP_ITEM'
          : input.action === DungeonLogAction.UNEQUIP_ITEM
            ? 'UNEQUIP_ITEM'
            : 'DISCARD_ITEM',
      details: {
        item: {
          id: input.item.id,
          code: input.item.code,
          slot: input.item.slot,
          rarity: input.item.rarity,
          name: input.item.name ?? null,
          modifiers: input.item.modifiers,
        },
        replacedItem: input.replaced
          ? {
              id: input.replaced.id,
              code: input.replaced.code,
              slot: input.replaced.slot,
              rarity: input.replaced.rarity,
              name: input.replaced.name ?? null,
            }
          : undefined,
      },
    };
  }
}
