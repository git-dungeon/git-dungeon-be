import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RANKING_DEFAULT_LIMIT, RANKING_MAX_LIMIT } from './ranking.constants';
import { encodeRankingCursor } from './ranking-cursor.util';
import type { RankingPayload } from './dto/ranking-response.dto';

interface RankingQuery {
  limit?: number;
  offset?: number;
}

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  async getRanking(query: RankingQuery): Promise<RankingPayload> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);

    const states = await this.prisma.dungeonState.findMany({
      skip: offset,
      take: limit + 1,
      orderBy: [
        { maxFloor: 'desc' },
        { level: 'desc' },
        { exp: 'desc' },
        { userId: 'asc' },
      ],
      select: {
        userId: true,
        level: true,
        maxFloor: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    const hasNext = states.length > limit;
    const slice = hasNext ? states.slice(0, limit) : states;

    const rankings = slice.map((state, index) => ({
      rank: offset + index + 1,
      displayName: state.user?.name ?? null,
      avatarUrl: state.user?.image ?? null,
      level: state.level,
      maxFloor: state.maxFloor,
    }));

    return {
      rankings,
      nextCursor: hasNext
        ? encodeRankingCursor({ offset: offset + limit })
        : null,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit <= 0) {
      return RANKING_DEFAULT_LIMIT;
    }

    return Math.min(limit, RANKING_MAX_LIMIT);
  }

  private normalizeOffset(offset?: number): number {
    if (!offset || offset < 0) {
      return 0;
    }

    return offset;
  }
}
