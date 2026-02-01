import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, type InventoryItem } from '@prisma/client';
import { loadCatalogData } from '../../catalog';
import type { CatalogItem } from '../../catalog/catalog.schema';
import {
  addEquipmentStats,
  calculateEquipmentBonus,
  createEmptyEquipmentStats,
} from '../inventory/equipment-stats';
import {
  parseInventoryModifiers,
  type InventoryModifier,
} from '../inventory/inventory-modifier';
import type { EquipmentStats } from '../../inventory/dto/inventory.response';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class StatsCacheService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureStatsCache(
    userId: string,
    prismaClient: PrismaClient = this.prisma,
    options?: { forceRefresh?: boolean },
  ): Promise<EquipmentStats> {
    const [state, equippedItems, catalog] = await Promise.all([
      prismaClient.dungeonState.findUnique({ where: { userId } }),
      prismaClient.inventoryItem.findMany({
        where: { userId, isEquipped: true },
        select: {
          id: true,
          code: true,
          modifiers: true,
          modifierVersion: true,
          enhancementLevel: true,
          slot: true,
        },
      }),
      loadCatalogData(),
    ]);

    if (!state) {
      throw new UnauthorizedException({
        code: 'INVENTORY_UNAUTHORIZED',
        message: '인벤토리를 조회할 수 없습니다.',
      });
    }

    const catalogVersion = catalog.version;
    const catalogItemMap = buildCatalogItemMap(catalog.items);
    const updates: Array<{
      id: string;
      modifiers: InventoryModifier[];
      modifierVersion: number;
    }> = [];

    const modifiersList = equippedItems.map((item) => {
      const resolved = resolveItemModifiers(
        item,
        catalogItemMap,
        catalogVersion,
      );
      if (resolved.updated) {
        updates.push({
          id: item.id,
          modifiers: resolved.modifiers,
          modifierVersion: catalogVersion,
        });
      }
      return resolved.modifiers;
    });

    const baseStats: EquipmentStats = {
      hp: state.maxHp,
      maxHp: state.maxHp,
      atk: state.atk,
      def: state.def,
      luck: state.luck,
    };
    const enhancementBonus = calculateEnhancementBonus(equippedItems);
    const hasCachedBonus = isEquipmentStats(state.equipmentBonus);
    const cachedBonus = hasCachedBonus
      ? (state.equipmentBonus as unknown as EquipmentStats)
      : undefined;
    const shouldRefresh =
      options?.forceRefresh === true ||
      state.statsVersion !== catalogVersion ||
      updates.length > 0 ||
      !hasCachedBonus;

    if (!shouldRefresh && cachedBonus) {
      return cachedBonus;
    }

    const equipmentBonus = addEquipmentStats(
      calculateEquipmentBonus(baseStats, modifiersList),
      enhancementBonus,
    );

    if (updates.length > 0 || shouldRefresh) {
      const inventoryUpdateOps = updates.map((update) =>
        prismaClient.inventoryItem.update({
          where: { id: update.id },
          data: {
            modifiers: update.modifiers as unknown as Prisma.InputJsonValue,
            modifierVersion: update.modifierVersion,
          },
        }),
      );
      const stateUpdateOp = shouldRefresh
        ? prismaClient.dungeonState.update({
            where: { userId },
            data: {
              equipmentBonus:
                equipmentBonus as unknown as Prisma.InputJsonValue,
              statsVersion: catalogVersion,
            },
          })
        : null;

      if ('$transaction' in prismaClient) {
        const ops = stateUpdateOp
          ? [...inventoryUpdateOps, stateUpdateOp]
          : inventoryUpdateOps;
        if (ops.length > 0) {
          await prismaClient.$transaction(ops);
        }
      } else {
        for (const op of inventoryUpdateOps) {
          await op;
        }
        if (stateUpdateOp) {
          await stateUpdateOp;
        }
      }
    }

    return equipmentBonus;
  }
}

function calculateEnhancementBonus(
  items: Array<
    Pick<InventoryItem, 'slot' | 'enhancementLevel'>
  >,
): EquipmentStats {
  const bonus = createEmptyEquipmentStats();

  for (const item of items) {
    const level = item.enhancementLevel ?? 0;
    if (level <= 0) {
      continue;
    }

    switch (item.slot) {
      case 'WEAPON':
        bonus.atk += level;
        break;
      case 'ARMOR':
      case 'HELMET':
        bonus.def += level;
        break;
      case 'RING':
        bonus.luck += level;
        break;
      default:
        break;
    }
  }

  return bonus;
}

function buildCatalogItemMap(items: CatalogItem[]): Map<string, CatalogItem> {
  return new Map(items.map((item) => [item.code, item]));
}

function resolveItemModifiers(
  item: Pick<InventoryItem, 'code' | 'modifiers' | 'modifierVersion'>,
  catalogItemMap: Map<string, CatalogItem>,
  catalogVersion: number,
): { modifiers: InventoryModifier[]; updated: boolean } {
  const current = parseInventoryModifiers(item.modifiers);
  if (item.modifierVersion === catalogVersion) {
    return { modifiers: current, updated: false };
  }

  const catalogItem = catalogItemMap.get(item.code);
  if (!catalogItem) {
    return { modifiers: current, updated: false };
  }

  const next = catalogItem.modifiers ?? [];
  return { modifiers: next, updated: true };
}

function isEquipmentStats(value: unknown): value is EquipmentStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stats = value as Record<string, unknown>;
  return (
    typeof stats.hp === 'number' &&
    typeof stats.maxHp === 'number' &&
    typeof stats.atk === 'number' &&
    typeof stats.def === 'number' &&
    typeof stats.luck === 'number'
  );
}
