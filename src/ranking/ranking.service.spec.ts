import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { encodeRankingCursor } from './ranking-cursor.util';
import { RankingService } from './ranking.service';

describe('RankingService', () => {
  const prismaMock = {
    dungeonState: {
      findMany: vi.fn(),
    },
  };

  const service = new RankingService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.dungeonState.findMany.mockReset();
  });

  it('정렬/페이징 옵션을 전달한다', async () => {
    prismaMock.dungeonState.findMany.mockResolvedValue([]);

    await service.getRanking({ limit: 10, offset: 0 });

    expect(prismaMock.dungeonState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 11,
        orderBy: [
          { maxFloor: 'desc' },
          { level: 'desc' },
          { exp: 'desc' },
          { userId: 'asc' },
        ],
      }),
    );
  });

  it('nextCursor와 rank를 계산한다', async () => {
    const records = [
      {
        userId: 'user-1',
        level: 10,
        maxFloor: 20,
        user: { name: 'Hero', image: 'https://example.com/1.png' },
      },
      {
        userId: 'user-2',
        level: 9,
        maxFloor: 19,
        user: { name: null, image: null },
      },
      {
        userId: 'user-3',
        level: 8,
        maxFloor: 18,
        user: { name: 'Mage', image: 'https://example.com/3.png' },
      },
    ];

    prismaMock.dungeonState.findMany.mockResolvedValue(records);

    const result = await service.getRanking({ limit: 2, offset: 10 });

    expect(result.rankings).toHaveLength(2);
    expect(result.rankings[0]).toMatchObject({
      rank: 11,
      displayName: 'Hero',
      avatarUrl: 'https://example.com/1.png',
      level: 10,
      maxFloor: 20,
    });
    expect(result.rankings[1]).toMatchObject({
      rank: 12,
      displayName: null,
      avatarUrl: null,
      level: 9,
      maxFloor: 19,
    });
    expect(result.nextCursor).toBe(encodeRankingCursor({ offset: 12 }));
  });
});
