import {
  BadRequestException,
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
  type InventoryRarity as PrismaInventoryRarity,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import seedrandom from 'seedrandom';
import typia, { TypeGuardError } from 'typia';
import { parseInventoryModifiers } from '../common/inventory/inventory-modifier';
import { addEquipmentStats } from '../common/inventory/equipment-stats';
import {
  extractFlatStatModifiers,
  extractEnhancementStatModifiers,
  addStatsDelta,
  calculateStatsDiff,
  isEmptyStatsDelta,
} from '../common/stats/stat-delta.util';
import { PrismaService } from '../prisma/prisma.service';
import { loadCatalogData } from '../catalog';
import type {
  CatalogDismantleConfig,
  CatalogEnhancementConfig,
} from '../catalog/catalog.schema';
import type {
  EquipmentItem,
  EquipmentStats,
  EquippedItems,
  EquippableSlot,
  InventoryResponse,
  InventoryRarity,
  InventorySlot,
} from './dto/inventory.response';
import type {
  DungeonLogDelta,
  InventoryDelta,
  StatsDelta,
} from '../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../common/logs/dungeon-log-extra';
import { StatsCacheService } from '../common/stats/stats-cache.service';

type InventoryLogAction =
  | 'EQUIP_ITEM'
  | 'UNEQUIP_ITEM'
  | 'DISCARD_ITEM'
  | 'DISMANTLE_ITEM'
  | 'ENHANCE_ITEM';

const EQUIPPABLE_SLOTS: EquippableSlot[] = [
  'helmet',
  'armor',
  'weapon',
  'ring',
];

const DISMANTLE_TARGET_SLOTS: InventorySlot[] = [
  'helmet',
  'armor',
  'weapon',
  'ring',
];

const MATERIAL_CODE_BY_SLOT: Record<InventorySlot, string> = {
  helmet: 'material-leather-scrap',
  armor: 'material-cloth-scrap',
  weapon: 'material-metal-scrap',
  ring: 'material-mithril-dust',
  consumable: '',
  material: '',
};

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
        forceStatsRefresh: true,
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
        forceStatsRefresh: true,
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
      quantity?: number;
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

      const currentQuantity = target.quantity ?? 1;
      const discardQuantity = payload.quantity ?? currentQuantity;

      if (discardQuantity < 1 || discardQuantity > currentQuantity) {
        throw new BadRequestException({
          code: 'INVENTORY_INVALID_REQUEST',
          message: '버릴 수량이 올바르지 않습니다.',
        });
      }

      if (discardQuantity < currentQuantity) {
        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: target.id,
            userId,
            version: payload.expectedVersion,
          },
          data: {
            quantity: currentQuantity - discardQuantity,
            version: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          throw new PreconditionFailedException({
            code: 'INVENTORY_VERSION_MISMATCH',
            message: '아이템 버전이 일치하지 않습니다.',
          });
        }
      } else {
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
      }

      const logItem = {
        ...this.mapInventoryItem(target),
        quantity: discardQuantity,
      };

      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.DISCARD_ITEM,
        item: logItem,
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: currentInventoryVersion + 1,
        forceStatsRefresh: target.isEquipped,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  async dismantleItem(
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
          message: '장착 중인 아이템은 분해할 수 없습니다.',
        });
      }

      const targetSlot = target.slot.toLowerCase() as InventorySlot;
      const targetRarity = target.rarity.toLowerCase() as InventoryRarity;

      const dismantleConfig = await this.loadDismantleConfig();
      const enhancementConfig = await this.loadEnhancementConfig();

      if (!this.isEquippableSlot(targetSlot)) {
        throw new BadRequestException({
          code: 'INVENTORY_INVALID_REQUEST',
          message: '분해할 수 없는 슬롯입니다.',
        });
      }

      const materialCode = enhancementConfig.materialsBySlot[targetSlot];
      if (!materialCode) {
        throw new InternalServerErrorException({
          code: 'INVENTORY_INVALID_RESPONSE',
          message: '분해 설정을 불러올 수 없습니다.',
        });
      }
      const materialQuantity =
        dismantleConfig.baseMaterialQuantityByRarity[targetRarity] ??
        this.resolveMaterialQuantity(targetRarity);
      const enhancementLevel = target.enhancementLevel ?? 0;
      const enhancementRefund =
        dismantleConfig.refundByEnhancementLevel[String(enhancementLevel)] ??
        this.calculateEnhancementRefund(enhancementLevel);
      const totalMaterialQuantity = materialQuantity + enhancementRefund;
      const materialRarity = this.resolveMaterialRarity(materialCode);

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

      const existingMaterials = await tx.inventoryItem.findMany({
        where: { userId, code: materialCode, slot: 'MATERIAL' },
        orderBy: { obtainedAt: 'asc' },
      });

      const existingMaterial = existingMaterials[0];
      const materialItemId = existingMaterial?.id ?? randomUUID();
      const nextVersion = currentInventoryVersion + 1;

      if (existingMaterial) {
        const totalQuantity =
          existingMaterials.reduce(
            (sum, item) => sum + (item.quantity ?? 1),
            0,
          ) + totalMaterialQuantity;

        await tx.inventoryItem.update({
          where: { id: existingMaterial.id },
          data: {
            quantity: totalQuantity,
            version: nextVersion,
          },
        });

        const duplicateIds = existingMaterials.slice(1).map((item) => item.id);

        if (duplicateIds.length > 0) {
          await tx.inventoryItem.deleteMany({
            where: { id: { in: duplicateIds }, userId },
          });
        }
      } else {
        await tx.inventoryItem.create({
          data: {
            id: materialItemId,
            userId,
            code: materialCode,
            slot: 'MATERIAL',
            rarity: materialRarity,
            modifiers: [],
            isEquipped: false,
            quantity: totalMaterialQuantity,
            version: nextVersion,
          },
        });
      }

      const materialRarityLabel =
        materialRarity.toLowerCase() as InventoryRarity;
      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.DISMANTLE_ITEM,
        item: this.mapInventoryItem(target),
        added: [
          {
            itemId: materialItemId,
            code: materialCode,
            slot: 'material',
            rarity: materialRarityLabel,
            quantity: totalMaterialQuantity,
          },
        ],
        materials: [{ code: materialCode, quantity: totalMaterialQuantity }],
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: nextVersion,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  async enhanceItem(
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

      const targetSlot = target.slot.toLowerCase() as InventorySlot;
      if (!this.isEquippableSlot(targetSlot)) {
        throw new BadRequestException({
          code: 'INVENTORY_INVALID_REQUEST',
          message: '강화할 수 없는 슬롯입니다.',
        });
      }

      const enhancementLevel = target.enhancementLevel ?? 0;
      const enhancementConfig = await this.loadEnhancementConfig();

      if (enhancementLevel >= enhancementConfig.maxLevel) {
        throw new BadRequestException({
          code: 'INVENTORY_MAX_ENHANCEMENT',
          message: '강화 레벨이 최대치입니다.',
        });
      }

      const nextLevel = enhancementLevel + 1;
      const enhancementSlot = targetSlot;
      const { successRate, goldCost, materialCount, materialCode } =
        this.resolveEnhancementCost(
          enhancementConfig,
          nextLevel,
          enhancementSlot,
        );

      const state = await tx.dungeonState.findUnique({ where: { userId } });
      if (!state) {
        throw new UnauthorizedException({
          code: 'INVENTORY_UNAUTHORIZED',
          message: '인벤토리를 조회할 수 없습니다.',
        });
      }

      if (state.gold < goldCost) {
        throw new BadRequestException({
          code: 'INVENTORY_INSUFFICIENT_GOLD',
          message: '골드가 부족합니다.',
        });
      }

      const materialItems = await tx.inventoryItem.findMany({
        where: { userId, code: materialCode, slot: 'MATERIAL' },
        orderBy: { obtainedAt: 'asc' },
      });
      const totalMaterialQuantity = materialItems.reduce(
        (sum, item) => sum + (item.quantity ?? 1),
        0,
      );

      if (totalMaterialQuantity < materialCount) {
        throw new BadRequestException({
          code: 'INVENTORY_INSUFFICIENT_MATERIALS',
          message: '강화 재료가 부족합니다.',
        });
      }

      const rngSeed = this.buildEnhancementSeed(
        userId,
        target.id,
        nextLevel,
        currentInventoryVersion,
      );
      const rng = seedrandom(rngSeed);
      const success = rng.quick() < successRate;

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: target.id,
          userId,
          version: payload.expectedVersion,
        },
        data: {
          enhancementLevel: success ? nextLevel : enhancementLevel,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'INVENTORY_VERSION_MISMATCH',
          message: '아이템 버전이 일치하지 않습니다.',
        });
      }

      const goldDecremented = await tx.dungeonState.updateMany({
        where: {
          userId,
          gold: { gte: goldCost },
        },
        data: { gold: { decrement: goldCost } },
      });

      if (goldDecremented.count === 0) {
        throw new BadRequestException({
          code: 'INVENTORY_INSUFFICIENT_GOLD',
          message: '골드가 부족합니다.',
        });
      }

      const consumedMaterials = await this.consumeMaterials(
        tx,
        userId,
        materialItems,
        materialCount,
      );

      const enhancementStatsDelta = this.buildEnhancementStatsDelta({
        slot: targetSlot,
        success,
        isEquipped: target.isEquipped,
      });

      await this.appendInventoryLog(tx, userId, {
        action: DungeonLogAction.ENHANCE_ITEM,
        item: {
          ...this.mapInventoryItem(target),
          enhancementLevel: success ? nextLevel : enhancementLevel,
        },
        materials: [{ code: materialCode, quantity: materialCount }],
        consumedMaterials,
        enhancement: {
          before: enhancementLevel,
          after: success ? nextLevel : enhancementLevel,
          success,
          chance: successRate,
          gold: goldCost,
          materials: [{ code: materialCode, quantity: materialCount }],
          statsDelta: enhancementStatsDelta,
        },
      });

      const response = await this.buildInventoryResponse(tx, userId, {
        forcedInventoryVersion: currentInventoryVersion + 1,
        forceStatsRefresh: true,
      });

      return this.assertInventoryResponse(userId, response);
    });
  }

  private async buildInventoryResponse(
    prismaClient: PrismaService | Prisma.TransactionClient,
    userId: string,
    options?: { forcedInventoryVersion?: number; forceStatsRefresh?: boolean },
  ): Promise<InventoryResponse> {
    const equipmentBonus = await this.statsCacheService.ensureStatsCache(
      userId,
      prismaClient,
      {
        forceRefresh: options?.forceStatsRefresh,
      },
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
      quantity: item.quantity ?? 1,
      enhancementLevel: item.enhancementLevel ?? 0,
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

  private resolveMaterialCode(slot: InventorySlot): string {
    if (!DISMANTLE_TARGET_SLOTS.includes(slot)) {
      throw new BadRequestException({
        code: 'INVENTORY_INVALID_REQUEST',
        message: '분해할 수 없는 슬롯입니다.',
      });
    }

    return MATERIAL_CODE_BY_SLOT[slot];
  }

  private resolveMaterialQuantity(rarity: InventoryRarity): number {
    switch (rarity) {
      case 'common':
        return 1;
      case 'uncommon':
        return 2;
      case 'rare':
        return 3;
      case 'epic':
        return 4;
      case 'legendary':
        return 5;
      default:
        return 1;
    }
  }

  private resolveMaterialRarity(_code: string): PrismaInventoryRarity {
    return 'COMMON';
  }

  private async loadEnhancementConfig(): Promise<CatalogEnhancementConfig> {
    const catalog = await loadCatalogData();
    return catalog.enhancement;
  }

  private async loadDismantleConfig(): Promise<CatalogDismantleConfig> {
    const catalog = await loadCatalogData();
    return catalog.dismantle;
  }

  private resolveEnhancementCost(
    config: CatalogEnhancementConfig,
    nextLevel: number,
    slot: EquippableSlot,
  ): {
    successRate: number;
    goldCost: number;
    materialCount: number;
    materialCode: string;
  } {
    const levelKey = String(nextLevel);
    const successRate = config.successRates[levelKey];
    const goldCost = config.goldCosts[levelKey];
    const materialCount = config.materialCounts[levelKey];
    const materialCode = config.materialsBySlot[slot];

    if (
      successRate === undefined ||
      goldCost === undefined ||
      materialCount === undefined ||
      !materialCode
    ) {
      throw new InternalServerErrorException({
        code: 'INVENTORY_INVALID_RESPONSE',
        message: '강화 설정을 불러올 수 없습니다.',
      });
    }

    return { successRate, goldCost, materialCount, materialCode };
  }

  private buildEnhancementSeed(
    userId: string,
    itemId: string,
    nextLevel: number,
    inventoryVersion: number,
  ): string {
    return `${userId}:enhance:${itemId}:${nextLevel}:${inventoryVersion}`;
  }

  private async consumeMaterials(
    tx: Prisma.TransactionClient,
    userId: string,
    materialItems: InventoryItem[],
    quantity?: number | null,
  ): Promise<Array<{ itemId: string; code: string; quantity: number }>> {
    const required = quantity ?? 1;
    if (!Number.isFinite(required) || required <= 0) {
      return [];
    }

    let remaining = required;
    const consumed: Array<{ itemId: string; code: string; quantity: number }> =
      [];

    for (const item of materialItems) {
      if (remaining <= 0) {
        break;
      }

      const currentQuantity = item.quantity ?? 1;
      if (currentQuantity <= remaining) {
        const deleted = await tx.inventoryItem.deleteMany({
          where: {
            id: item.id,
            userId,
            code: item.code,
            slot: 'MATERIAL',
            version: item.version,
            quantity: currentQuantity,
          },
        });
        if (deleted.count === 0) {
          throw new ConflictException({
            code: 'INVENTORY_CONCURRENCY_CONFLICT',
            message: '강화 재료 처리 중 동시성 충돌이 발생했습니다.',
          });
        }
        remaining -= currentQuantity;
        consumed.push({
          itemId: item.id,
          code: item.code,
          quantity: currentQuantity,
        });
        continue;
      }

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          userId,
          code: item.code,
          slot: 'MATERIAL',
          version: item.version,
          quantity: { gte: remaining },
        },
        data: {
          quantity: { decrement: remaining },
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: 'INVENTORY_CONCURRENCY_CONFLICT',
          message: '강화 재료 처리 중 동시성 충돌이 발생했습니다.',
        });
      }
      consumed.push({
        itemId: item.id,
        code: item.code,
        quantity: remaining,
      });
      remaining = 0;
    }

    if (remaining > 0) {
      throw new InternalServerErrorException({
        code: 'INVENTORY_INVALID_RESPONSE',
        message: '강화 재료 처리에 실패했습니다.',
      });
    }

    return consumed;
  }

  private calculateEnhancementRefund(level: number): number {
    if (level <= 0) {
      return 0;
    }

    const total = (level * (level + 1)) / 2;
    return Math.floor(total / 2);
  }

  private buildEnhancementStatsDelta(input: {
    slot: InventorySlot;
    success: boolean;
    isEquipped: boolean;
  }): StatsDelta | undefined {
    if (!input.success || !input.isEquipped) {
      return undefined;
    }

    switch (input.slot) {
      case 'weapon':
        return { atk: 1 };
      case 'armor':
      case 'helmet':
        return { def: 1 };
      case 'ring':
        return { luck: 1 };
      default:
        return undefined;
    }
  }

  private mapEquipped(items: EquipmentItem[]): EquippedItems {
    return items.reduce<EquippedItems>((acc, item) => {
      if (item.isEquipped && this.isEquippableSlot(item.slot)) {
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

  private isEquippableSlot(slot: string): slot is EquippableSlot {
    return EQUIPPABLE_SLOTS.includes(slot as EquippableSlot);
  }

  private async appendInventoryLog(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      action: InventoryLogAction;
      item: EquipmentItem;
      replaced?: EquipmentItem;
      added?: InventoryDelta['added'];
      materials?: Array<{ code: string; quantity?: number }>;
      consumedMaterials?: Array<{
        itemId: string;
        code: string;
        quantity?: number;
      }>;
      enhancement?: {
        before: number;
        after: number;
        success: boolean;
        chance: number;
        gold: number;
        materials: Array<{ code: string; quantity?: number }>;
        statsDelta?: StatsDelta;
      };
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
    added?: InventoryDelta['added'];
    consumedMaterials?: Array<{
      itemId: string;
      code: string;
      quantity?: number;
    }>;
    enhancement?: {
      statsDelta?: StatsDelta;
    };
  }): DungeonLogDelta {
    if (input.action === DungeonLogAction.EQUIP_ITEM) {
      const equipStats = addStatsDelta(
        extractFlatStatModifiers(input.item.modifiers),
        extractEnhancementStatModifiers(input.item),
      );
      const unequipStats = input.replaced
        ? addStatsDelta(
            extractFlatStatModifiers(input.replaced.modifiers),
            extractEnhancementStatModifiers(input.replaced),
          )
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
      const unequipStats = addStatsDelta(
        extractFlatStatModifiers(input.item.modifiers),
        extractEnhancementStatModifiers(input.item),
      );
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

    if (input.action === DungeonLogAction.DISMANTLE_ITEM) {
      return {
        type: 'DISMANTLE_ITEM',
        detail: {
          inventory: {
            removed: [
              {
                itemId: input.item.id,
                code: input.item.code,
                quantity: input.item.quantity ?? 1,
              },
            ],
            added: input.added ?? [],
          },
        },
      };
    }

    if (input.action === DungeonLogAction.ENHANCE_ITEM) {
      return {
        type: 'ENHANCE_ITEM',
        detail: {
          inventory: {
            removed: input.consumedMaterials ?? [],
          },
          stats: input.enhancement?.statsDelta,
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
              quantity: input.item.quantity ?? 1,
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
    materials?: Array<{ code: string; quantity?: number }>;
    enhancement?: {
      before: number;
      after: number;
      success: boolean;
      chance: number;
      gold: number;
      materials: Array<{ code: string; quantity?: number }>;
    };
  }): DungeonLogDetails {
    if (input.action === DungeonLogAction.ENHANCE_ITEM) {
      return {
        type: 'ENHANCE_ITEM',
        details: {
          item: {
            id: input.item.id,
            code: input.item.code,
            slot: input.item.slot,
            rarity: input.item.rarity,
            name: input.item.name ?? null,
            modifiers: input.item.modifiers,
          },
          enhancement: input.enhancement
            ? {
                before: input.enhancement.before,
                after: input.enhancement.after,
                success: input.enhancement.success,
                chance: input.enhancement.chance,
              }
            : undefined,
          cost: input.enhancement
            ? {
                gold: input.enhancement.gold,
                materials: input.enhancement.materials,
              }
            : undefined,
        },
      };
    }

    return {
      type:
        input.action === DungeonLogAction.EQUIP_ITEM
          ? 'EQUIP_ITEM'
          : input.action === DungeonLogAction.UNEQUIP_ITEM
            ? 'UNEQUIP_ITEM'
            : input.action === DungeonLogAction.DISMANTLE_ITEM
              ? 'DISMANTLE_ITEM'
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
        materials:
          input.action === DungeonLogAction.DISMANTLE_ITEM
            ? (input.materials ?? [])
            : undefined,
      },
    };
  }
}
