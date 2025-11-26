/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma, ApSyncStatus, ApSyncTokenType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubSyncService } from '../github-sync.service';
import type { PrismaService } from '../../prisma/prisma.service';

type MockPrismaTx = {
  apSyncLog: {
    findUnique: (args: Prisma.ApSyncLogFindUniqueArgs) => Promise<unknown>;
    create: (args: Prisma.ApSyncLogCreateArgs) => Promise<unknown>;
    update: (args: Prisma.ApSyncLogUpdateArgs) => Promise<unknown>;
  };
  dungeonState: {
    update: (args: Prisma.DungeonStateUpdateArgs) => Promise<unknown>;
  };
  account: {
    updateMany: (args: Prisma.AccountUpdateManyArgs) => Promise<unknown>;
  };
};

type PrismaLike = {
  $transaction: <T>(fn: (tx: MockPrismaTx) => Promise<T> | T) => Promise<T> | T;
};

const createPrismaMock = () => {
  const findUnique =
    vi.fn<(args: Prisma.ApSyncLogFindUniqueArgs) => Promise<unknown>>();
  const create =
    vi.fn<(args: Prisma.ApSyncLogCreateArgs) => Promise<unknown>>();
  const update =
    vi.fn<(args: Prisma.ApSyncLogUpdateArgs) => Promise<unknown>>();
  const updateState =
    vi.fn<(args: Prisma.DungeonStateUpdateArgs) => Promise<unknown>>();
  const updateAccount =
    vi.fn<(args: Prisma.AccountUpdateManyArgs) => Promise<unknown>>();

  const tx: MockPrismaTx = {
    apSyncLog: {
      findUnique:
        findUnique as unknown as MockPrismaTx['apSyncLog']['findUnique'],
      create: create as unknown as MockPrismaTx['apSyncLog']['create'],
      update: update as unknown as MockPrismaTx['apSyncLog']['update'],
    },
    dungeonState: {
      update: updateState as unknown as MockPrismaTx['dungeonState']['update'],
    },
    account: {
      updateMany:
        updateAccount as unknown as MockPrismaTx['account']['updateMany'],
    },
  };

  const prisma: PrismaLike = {
    $transaction: <T>(fn: (txArg: MockPrismaTx) => Promise<T> | T) => fn(tx),
  };

  return {
    tx,
    prisma: prisma as unknown as PrismaService,
    mocks: { findUnique, create, update, updateState, updateAccount },
  };
};

describe('GithubSyncService', () => {
  const baseParams = {
    userId: 'user-1',
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

    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: 'log-1',
      status: ApSyncStatus.SUCCESS,
    });

    const { apDelta } = await service.applyContributionSync({
      ...baseParams,
      contributions: Number(baseParams.contributions),
    });

    expect(mocks.updateState).toHaveBeenCalledWith({
      where: { userId: baseParams.userId },
      data: { ap: { increment: baseParams.contributions } },
    });
    expect(mocks.updateAccount).toHaveBeenCalled();
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
    const existing: { id: string; status: ApSyncStatus; apDelta: number } = {
      id: 'log-existing',
      status: ApSyncStatus.SUCCESS,
      apDelta: 3,
    };

    mocks.findUnique.mockResolvedValue(existing);

    const result = await service.applyContributionSync(baseParams);

    expect(mocks.updateState).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.apDelta).toBe(existing.apDelta);
  });

  it('이전 실패 로그가 있으면 갱신하고 AP를 적재한다', async () => {
    const { prisma, mocks } = createPrismaMock();

    const service = new GithubSyncService(prisma);
    const existing: { id: string; status: ApSyncStatus; apDelta: number } = {
      id: 'log-failed',
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

    expect(mocks.updateState).toHaveBeenCalledWith({
      where: { userId: baseParams.userId },
      data: { ap: { increment: 2 } },
    });
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
});
