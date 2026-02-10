import {
  BadRequestException,
  Inject,
  Injectable,
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
import type { LevelUpApplyRequest } from './dto/level-up-request.dto';
import type {
  LevelUpApplyResponse,
  LevelUpOption,
  LevelUpRarity,
  LevelUpSelectionResponse,
  LevelUpStat,
  LevelUpStatBlock,
} from './dto/level-up-response.dto';
import type {
  DungeonLogDelta,
  StatsDelta,
} from '../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../common/logs/dungeon-log-extra';
import {
  SEEDED_RNG_FACTORY,
  type SeededRandomFactory,
} from '../dungeon/events/seeded-rng.provider';

const LEVEL_UP_STATS = ['hp', 'atk', 'def', 'luck'] as const;

const RARITY_TABLE = [
  { rarity: 'common', weight: 50, value: 1 },
  { rarity: 'uncommon', weight: 30, value: 2 },
  { rarity: 'rare', weight: 15, value: 3 },
  { rarity: 'epic', weight: 4, value: 4 },
  { rarity: 'legendary', weight: 1, value: 5 },
] as const;

const TOTAL_RARITY_WEIGHT = RARITY_TABLE.reduce(
  (sum, entry) => sum + entry.weight,
  0,
);

@Injectable()
export class LevelUpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEEDED_RNG_FACTORY)
    private readonly rngFactory: SeededRandomFactory,
  ) {}

  async getSelection(userId: string): Promise<LevelUpSelectionResponse> {
    const state = await this.prisma.dungeonState.findUnique({
      where: { userId },
    });

    if (!state) {
      throw new UnauthorizedException({
        code: 'LEVEL_UP_UNAUTHORIZED',
        message: '레벨업 정보를 조회할 수 없습니다.',
      });
    }

    const points = state.levelUpPoints;
    const rollIndex = state.levelUpRollIndex;

    const options =
      points > 0
        ? this.buildOptions(userId, rollIndex)
        : ([] as LevelUpOption[]);

    return {
      points,
      rollIndex,
      options,
    };
  }

  async applySelection(
    userId: string,
    payload: LevelUpApplyRequest,
  ): Promise<LevelUpApplyResponse> {
    this.assertApplyRequest(payload);

    const state = await this.prisma.dungeonState.findUnique({
      where: { userId },
    });

    if (!state) {
      throw new UnauthorizedException({
        code: 'LEVEL_UP_UNAUTHORIZED',
        message: '레벨업 정보를 조회할 수 없습니다.',
      });
    }

    if (state.levelUpPoints <= 0) {
      throw new BadRequestException({
        code: 'LEVEL_UP_NO_POINTS',
        message: '사용 가능한 레벨업 포인트가 없습니다.',
      });
    }

    if (payload.rollIndex !== state.levelUpRollIndex) {
      throw new PreconditionFailedException({
        code: 'LEVEL_UP_ROLL_MISMATCH',
        message: '레벨업 선택지가 최신 상태가 아닙니다.',
      });
    }

    const options = this.buildOptions(userId, state.levelUpRollIndex);
    const selected = options.find((option) => option.stat === payload.stat);

    if (!selected) {
      throw new BadRequestException({
        code: 'LEVEL_UP_INVALID_SELECTION',
        message: '선택한 능력치를 적용할 수 없습니다.',
      });
    }

    const nextStats = this.applyStatDelta(state, selected);
    const nextPoints = state.levelUpPoints - 1;
    const nextRollIndex = state.levelUpRollIndex + 1;
    const nextVersion = state.version + 1;

    const deltaStats = this.buildStatsDelta(selected.stat, selected.value);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dungeonState.updateMany({
        where: { userId, version: state.version },
        data: {
          levelUpPoints: nextPoints,
          levelUpRollIndex: nextRollIndex,
          hp: nextStats.hp,
          maxHp: nextStats.maxHp,
          atk: nextStats.atk,
          def: nextStats.def,
          luck: nextStats.luck,
          version: nextVersion,
        },
      });

      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'LEVEL_UP_STATE_CONFLICT',
          message: '레벨업 상태가 변경되었습니다. 다시 시도해주세요.',
        });
      }

      const delta: DungeonLogDelta = {
        type: 'STAT_APPLIED',
        detail: {
          stats: deltaStats,
        },
      };

      const extra: DungeonLogDetails = {
        type: 'STAT_APPLIED',
        details: {
          applied: deltaStats,
        },
      };

      await tx.dungeonLog.create({
        data: {
          userId,
          category: DungeonLogCategory.STATUS,
          action: DungeonLogAction.STAT_APPLIED,
          status: DungeonLogStatus.COMPLETED,
          floor: null,
          turnNumber: null,
          stateVersionBefore: state.version,
          stateVersionAfter: nextVersion,
          delta: delta as Prisma.InputJsonValue,
          extra: extra as Prisma.InputJsonValue,
          createdAt: new Date(),
        },
      });
    });

    return {
      points: nextPoints,
      rollIndex: nextRollIndex,
      applied: selected,
      stats: nextStats,
    };
  }

  private assertApplyRequest(payload: LevelUpApplyRequest): void {
    if (!this.isValidStat(payload.stat)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'stat 형식이 잘못되었습니다.',
        details: { field: 'stat' },
      });
    }

    if (!this.isNonNegativeInteger(payload.rollIndex)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'rollIndex 형식이 잘못되었습니다.',
        details: { field: 'rollIndex' },
      });
    }
  }

  private isValidStat(value: string): value is LevelUpStat {
    return LEVEL_UP_STATS.includes(value as LevelUpStat);
  }

  private isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  private buildOptions(userId: string, rollIndex: number): LevelUpOption[] {
    const seed = `${userId}:level-up:${rollIndex}`;
    const rng = this.rngFactory.create(seed);

    const statsPool = [...LEVEL_UP_STATS];
    const selectedStats: LevelUpStat[] = [];

    for (let i = 0; i < 3; i += 1) {
      const index = Math.floor(rng.next() * statsPool.length);
      const stat = statsPool.splice(index, 1)[0];
      selectedStats.push(stat);
    }

    return selectedStats.map((stat) => ({
      stat,
      ...this.rollRarity(rng),
    }));
  }

  private rollRarity(rng: { next: () => number }): {
    rarity: LevelUpRarity;
    value: number;
  } {
    const roll = rng.next() * TOTAL_RARITY_WEIGHT;
    let acc = 0;

    for (const entry of RARITY_TABLE) {
      acc += entry.weight;
      if (roll <= acc) {
        return { rarity: entry.rarity, value: entry.value };
      }
    }

    const fallback = RARITY_TABLE[RARITY_TABLE.length - 1];
    return { rarity: fallback.rarity, value: fallback.value };
  }

  private buildStatsDelta(stat: LevelUpStat, value: number): StatsDelta {
    if (stat === 'hp') {
      return {
        hp: value,
        maxHp: value,
      };
    }

    return {
      [stat]: value,
    } as StatsDelta;
  }

  private applyStatDelta(
    state: {
      hp: number;
      maxHp: number;
      atk: number;
      def: number;
      luck: number;
    },
    selected: LevelUpOption,
  ): LevelUpStatBlock {
    if (selected.stat === 'hp') {
      const nextMaxHp = state.maxHp + selected.value;
      const nextHp = Math.min(nextMaxHp, state.hp + selected.value);
      return {
        hp: nextHp,
        maxHp: nextMaxHp,
        atk: state.atk,
        def: state.def,
        luck: state.luck,
      };
    }

    return {
      hp: state.hp,
      maxHp: state.maxHp,
      atk: selected.stat === 'atk' ? state.atk + selected.value : state.atk,
      def: selected.stat === 'def' ? state.def + selected.value : state.def,
      luck: selected.stat === 'luck' ? state.luck + selected.value : state.luck,
    };
  }
}
