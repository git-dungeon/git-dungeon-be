import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import typia, { TypeGuardError } from 'typia';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DashboardStateResponse,
  EquipmentItem,
} from './dto/dashboard-state.response';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getState(userId: string): Promise<DashboardStateResponse> {
    const state = await this.prisma.dungeonState.findUnique({
      where: { userId },
    });

    if (!state) {
      throw new UnauthorizedException({
        code: 'DASHBOARD_UNAUTHORIZED',
        message: '던전 상태를 찾을 수 없습니다.',
      });
    }

    const equippedItems = await this.prisma.inventoryItem.findMany({
      where: { userId, isEquipped: true },
      orderBy: { obtainedAt: 'asc' },
    });

    const response: DashboardStateResponse = {
      state: {
        userId: state.userId,
        level: state.level,
        exp: state.exp,
        hp: state.hp,
        maxHp: state.maxHp,
        atk: state.atk,
        def: state.def,
        luck: state.luck,
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
      modifiers: (Array.isArray(item.modifiers)
        ? item.modifiers
        : []) as EquipmentItem['modifiers'],
      effect: null,
      sprite: null,
      createdAt: item.obtainedAt.toISOString(),
      isEquipped: item.isEquipped,
      version: item.version,
    };
  }
}
