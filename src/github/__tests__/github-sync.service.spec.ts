/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma, ApSyncStatus, ApSyncTokenType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubSyncService } from '../github-sync.service';
import { createSyncServiceTestbed } from './helpers';

type MockPrismaTx = {
  apSyncLog: {
    findFirst: (args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>;
    findUnique: (args: Prisma.ApSyncLogFindUniqueArgs) => Promise<unknown>;
    create: (args: Prisma.ApSyncLogCreateArgs) => Promise<unknown>;
    update: (args: Prisma.ApSyncLogUpdateArgs) => Promise<unknown>;
  };
  dungeonState: {
    upsert: (args: Prisma.DungeonStateUpsertArgs) => Promise<unknown>;
  };
  githubSyncState: {
    upsert: (args: Prisma.GithubSyncStateUpsertArgs) => Promise<unknown>;
  };
};

const createPrismaMock = () => {
  const {
    prisma,
    mocks: {
      findFirst,
      findUnique,
      create,
      update,
      upsertState,
      upsertSyncState,
    },
    tx,
  } = createSyncServiceTestbed();

  return {
    tx: tx as unknown as MockPrismaTx,
    prisma: prisma,
    mocks: {
      findFirst,
      findUnique,
      create,
      update,
      upsertState,
      upsertSyncState,
    },
  };
};

describe('GithubSyncService 동작', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
  const LOG_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LOG_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const LOG_ID_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const LOG_ID_LAST_SUCCESS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const baseParams = {
    userId: USER_ID_1,
    contributions: 5,
    windowStart: new Date('2025-11-01T00:00:00Z'),
    windowEnd: new Date('2025-11-02T00:00:00Z'),
    tokenType: ApSyncTokenType.OAUTH as ApSyncTokenType,
    rateLimitRemaining: 120,
    cursor: 'cursor-1',
  };

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('새 윈도우면 AP 적재 후 로그를 생성한다', async () => {
    const { prisma, mocks } = createPrismaMock();

    const service = new GithubSyncService(prisma);
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: LOG_ID_1,
      status: ApSyncStatus.SUCCESS,
    });

    const { apDelta } = await service.applyContributionSync({
      ...baseParams,
      contributions: Number(baseParams.contributions),
    });

    expect(mocks.upsertState).toHaveBeenCalledWith({
      where: { userId: baseParams.userId },
      update: { ap: { increment: baseParams.contributions } },
      create: {
        userId: baseParams.userId,
        ap: expect.any(Number),
      },
    });
    expect(mocks.upsertSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseParams.userId },
        update: { lastSuccessfulSyncAt: baseParams.windowEnd },
      }),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: baseParams.userId,
        contributions: baseParams.contributions,
        apDelta: Number(baseParams.contributions),
        tokenType: baseParams.tokenType,
        status: ApSyncStatus.SUCCESS,
      }),
    });
    expect(apDelta).toBe(baseParams.contributions);
  });

  it('이미 성공한 윈도우면 중복 적재하지 않는다', async () => {
    const { prisma, mocks } = createPrismaMock();

    const service = new GithubSyncService(prisma);
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const existing: { id: string; status: ApSyncStatus; apDelta: number } = {
      id: LOG_ID_2,
      status: ApSyncStatus.SUCCESS,
      apDelta: 3,
    };

    mocks.findUnique.mockResolvedValue(existing);

    const result = await service.applyContributionSync({
      ...baseParams,
      contributions: 0,
    });

    expect(mocks.upsertState).not.toHaveBeenCalled();
    expect(mocks.upsertSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseParams.userId },
        update: { lastSuccessfulSyncAt: baseParams.windowEnd },
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.apDelta).toBe(0);
  });

  it('이전 실패 로그가 있으면 갱신하고 AP를 적재한다', async () => {
    const { prisma, mocks } = createPrismaMock();

    const service = new GithubSyncService(prisma);
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const existing: { id: string; status: ApSyncStatus; apDelta: number } = {
      id: LOG_ID_3,
      status: ApSyncStatus.FAILED,
      apDelta: 0,
    };

    mocks.findUnique.mockResolvedValue(existing);
    mocks.update.mockResolvedValue({
      ...existing,
      status: ApSyncStatus.SUCCESS,
      apDelta: 2,
    });

    const { apDelta } = await service.applyContributionSync({
      ...baseParams,
      contributions: 2,
    });

    expect(mocks.upsertState).toHaveBeenCalledWith({
      where: { userId: baseParams.userId },
      update: { ap: { increment: 2 } },
      create: {
        userId: baseParams.userId,
        ap: expect.any(Number),
      },
    });
    expect(mocks.upsertSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseParams.userId },
        update: { lastSuccessfulSyncAt: baseParams.windowEnd },
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        status: ApSyncStatus.SUCCESS,
        contributions: 2,
        apDelta: Number(2),
      }),
    });
    expect(apDelta).toBe(2);
  });

  it('최근 성공 윈도우와 겹치면 건너뛴다', async () => {
    const { prisma, mocks } = createPrismaMock();

    const service = new GithubSyncService(prisma);
    const lastSuccess = {
      id: LOG_ID_LAST_SUCCESS,
      status: ApSyncStatus.SUCCESS,
      apDelta: 4,
      windowStart: new Date('2025-11-01T00:00:00Z'),
      windowEnd: new Date('2025-11-02T00:00:00Z'),
    } as const;

    mocks.findFirst
      .mockResolvedValueOnce(lastSuccess)
      .mockResolvedValueOnce(lastSuccess);

    const result = await service.applyContributionSync({
      ...baseParams,
      windowStart: new Date('2025-11-01T23:59:59Z'), // 겹치는 구간
      contributions: 0,
    });

    expect(result.apDelta).toBe(0);
    expect(result.log).toBe(lastSuccess);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.upsertState).not.toHaveBeenCalled();
    expect(mocks.upsertSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: baseParams.userId },
        update: { lastSuccessfulSyncAt: baseParams.windowEnd },
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
