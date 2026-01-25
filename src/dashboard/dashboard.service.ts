import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import typia, { TypeGuardError } from 'typia';
import { PrismaService } from '../prisma/prisma.service';
import {
  addEquipmentStats,
  calculateEquipmentBonus,
} from '../common/inventory/equipment-stats';
import { parseInventoryModifiers } from '../common/inventory/inventory-modifier';
import type {
  DashboardStateResponse,
  EquipmentItem,
  StatBlock,
} from './dto/dashboard-state.response';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getState(userId: string): Promise<DashboardStateResponse> {
    const [state, equippedItems] = await Promise.all([
      this.prisma.dungeonState.findUnique({
        where: { userId },
      }),
      this.prisma.inventoryItem.findMany({
        where: { userId, isEquipped: true },
        orderBy: { obtainedAt: 'asc' },
      }),
    ]);

    if (!state) {
      throw new UnauthorizedException({
        code: 'DASHBOARD_UNAUTHORIZED',
        message: '던전 상태를 찾을 수 없습니다.',
      });
    }

    const baseStats = {
      hp: state.maxHp,
      maxHp: state.maxHp,
      atk: state.atk,
      def: state.def,
      luck: state.luck,
    };
    const equipmentBonus = calculateEquipmentBonus(
      baseStats,
      equippedItems.map((item) => parseInventoryModifiers(item.modifiers)),
    );
    const totalStats = addEquipmentStats(baseStats, equipmentBonus);
    const maxHp = Math.max(0, totalStats.maxHp);
    const currentHp = Math.max(0, Math.min(state.hp, maxHp));
    const toStatBlock = (stats: {
      hp: number;
      maxHp: number;
      atk: number;
      def: number;
      luck: number;
    }): StatBlock => ({
      hp: stats.hp as StatBlock['hp'],
      maxHp: stats.maxHp as StatBlock['maxHp'],
      atk: stats.atk as StatBlock['atk'],
      def: stats.def as StatBlock['def'],
      luck: stats.luck as StatBlock['luck'],
    });

    const stats = {
      base: toStatBlock(baseStats),
      equipmentBonus: toStatBlock(equipmentBonus),
      total: toStatBlock(totalStats),
    };

    const response: DashboardStateResponse = {
      state: {
        userId: state.userId,
        level: state.level,
        exp: state.exp,
        levelUpPoints: state.levelUpPoints,
        hp: currentHp,
        maxHp,
        atk: totalStats.atk,
        def: totalStats.def,
        luck: totalStats.luck,
        floor: state.floor,
        maxFloor: state.maxFloor,
        floorProgress: state.floorProgress,
        gold: state.gold,
        ap: state.ap,
        currentAction: state.currentAction,
        currentActionStartedAt:
          state.currentActionStartedAt?.toISOString() ?? null,
        createdAt: state.createdAt.toISOString(),
        version: state.version,
        updatedAt: state.updatedAt.toISOString(),
        expToLevel: this.calculateExpToLevel(state.level),
        stats,
        equippedItems: equippedItems.map((item) => this.mapEquippedItem(item)),
      },
    };

    try {
      return typia.assert<DashboardStateResponse>(response);
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error(
          'DashboardStateResponse validation failed',
          JSON.stringify({
            path: error.path,
            expected: error.expected,
            value: error.value,
            userId,
          }),
        );

        throw new InternalServerErrorException({
          code: 'DASHBOARD_STATE_INVALID_RESPONSE',
          message: '대시보드 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
          },
        });
      }

      throw error;
    }
  }

  private calculateExpToLevel(level: number | null | undefined): number | null {
    if (!level || level < 0) {
      return null;
    }

    const required = level * 10;
    return required < 0 ? 0 : required;
  }

  private mapEquippedItem(item: {
    id: string;
    code: string;
    slot: string;
    rarity: string;
    modifiers: unknown;
    isEquipped: boolean;
    obtainedAt: Date;
    version: number;
  }): EquipmentItem {
    return {
      id: item.id,
      code: item.code,
      name: null,
      slot: item.slot.toLowerCase(),
      rarity: item.rarity.toLowerCase(),
      modifiers: parseInventoryModifiers(item.modifiers),
      effect: null,
      sprite: null,
      createdAt: item.obtainedAt.toISOString(),
      isEquipped: item.isEquipped,
      version: item.version,
    };
  }
}
