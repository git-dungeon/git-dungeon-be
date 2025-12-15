import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type InventoryItem } from '@prisma/client';
import typia, { TypeGuardError } from 'typia';
import {
  INVENTORY_STATS,
  normalizeInventoryModifier,
  type InventoryModifier,
  type InventoryStat,
} from '../common/inventory/inventory-modifier';
import { PrismaService } from '../prisma/prisma.service';
import type {
  EquipmentItem,
  EquipmentStats,
  EquippedItems,
  InventoryResponse,
  InventoryRarity,
  InventorySlot,
} from './dto/inventory.response';

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

  constructor(private readonly prisma: PrismaService) {}

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
    const equipmentBonus = this.calculateEquipmentBonus(baseStats, equipped);
    const summary = {
      equipmentBonus,
      total: this.addStats(baseStats, equipmentBonus),
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
    const modifiers = this.toInventoryModifiers(item.modifiers);
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
    hp: number;
    atk: number;
    def: number;
    luck: number;
  }): EquipmentStats {
    return {
      hp: dungeonState.hp,
      atk: dungeonState.atk,
      def: dungeonState.def,
      luck: dungeonState.luck,
    };
  }

  private calculateEquipmentBonus(
    baseStats: EquipmentStats,
    equipped: EquippedItems,
  ): EquipmentStats {
    const flat = this.createEmptyStats();
    const percent = this.createEmptyStats();

    const equippedItems = Object.values(equipped).filter(
      (item): item is EquipmentItem => Boolean(item),
    );

    equippedItems.forEach((item) => {
      item.modifiers.forEach((modifier) => {
        if (!this.isStatModifier(modifier)) {
          return;
        }

        if (modifier.mode === 'percent') {
          percent[modifier.stat] += modifier.value;
          return;
        }

        flat[modifier.stat] += modifier.value;
      });
    });

    const bonus = this.createEmptyStats();

    INVENTORY_STATS.forEach((stat) => {
      const flatValue = flat[stat];
      const percentValue = percent[stat];
      const base = baseStats[stat];

      bonus[stat] = flatValue + Math.floor((base + flatValue) * percentValue);
    });

    return bonus;
  }

  private addStats(
    base: EquipmentStats,
    bonus: EquipmentStats,
  ): EquipmentStats {
    return {
      hp: base.hp + bonus.hp,
      atk: base.atk + bonus.atk,
      def: base.def + bonus.def,
      luck: base.luck + bonus.luck,
    };
  }

  private toInventoryModifiers(modifiers: unknown): InventoryModifier[] {
    if (!Array.isArray(modifiers)) {
      return [];
    }

    const modifierArray: unknown[] = modifiers;

    return modifierArray
      .filter((modifier): modifier is InventoryModifier => {
        if (!this.isPlainObject(modifier) || !('kind' in modifier)) {
          return false;
        }

        if (modifier.kind === 'stat') {
          return 'stat' in modifier && 'value' in modifier;
        }

        if (modifier.kind === 'effect') {
          return 'effectCode' in modifier;
        }

        return false;
      })
      .map((modifier) => normalizeInventoryModifier(modifier));
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
  }

  private isStatModifier(
    modifier: InventoryModifier,
  ): modifier is Extract<InventoryModifier, { kind: 'stat' }> {
    return modifier.kind === 'stat' && this.isInventoryStat(modifier.stat);
  }

  private isInventoryStat(stat: string): stat is InventoryStat {
    return (INVENTORY_STATS as readonly string[]).includes(stat);
  }

  private isInventorySlot(slot: string): slot is InventorySlot {
    return INVENTORY_SLOTS.includes(slot as InventorySlot);
  }

  private createEmptyStats(): EquipmentStats {
    return { hp: 0, atk: 0, def: 0, luck: 0 };
  }
}
