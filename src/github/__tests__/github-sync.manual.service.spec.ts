import { BadRequestException } from '@nestjs/common';
import { ApSyncStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubGraphqlError } from '../github.interfaces';
import { GithubManualSyncService } from '../github-sync.manual.service';

type PrismaMock = {
  account: {
    findFirst: ReturnType<
      typeof vi.fn<(args: Prisma.AccountFindFirstArgs) => Promise<unknown>>
    >;
  };
  apSyncLog: {
    findFirst: ReturnType<
      typeof vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>
    >;
    upsert: ReturnType<
      typeof vi.fn<(args: Prisma.ApSyncLogUpsertArgs) => Promise<unknown>>
    >;
  };
};

const createService = () => {
  const prisma: PrismaMock = {
    account: {
      findFirst:
        vi.fn<(args: Prisma.AccountFindFirstArgs) => Promise<unknown>>(),
    },
    apSyncLog: {
      findFirst:
        vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>(),
      upsert: vi.fn<(args: Prisma.ApSyncLogUpsertArgs) => Promise<unknown>>(),
    },
  };

  const graphqlClient = {
    fetchContributions: vi.fn(),
  };

  const syncService = {
    applyContributionSync: vi.fn(),
  };

  const service = new GithubManualSyncService(
    prisma as never,
    graphqlClient as never,
    syncService as never,
  );

  return { prisma, graphqlClient, syncService, service };
};

describe('GithubManualSyncService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GitHub 계정이 없으면 400을 반환한다', async () => {
    const { service, prisma } = createService();
    prisma.account.findFirst.mockResolvedValue(null);
    prisma.apSyncLog.findFirst.mockResolvedValue(null);

    await expect(service.syncNow('user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.apSyncLog.upsert).not.toHaveBeenCalled();
  });

  it('최근 6시간 내 실행 이력이 있으면 막는다', async () => {
    const { service, prisma } = createService();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);

    await expect(service.syncNow('user-1')).rejects.toMatchObject({
      response: {
        error: { code: 'GITHUB_SYNC_TOO_FREQUENT' },
      },
      status: 429,
    });
  });

  it('성공 시 기여 수를 계산해 AP 적재를 호출한다', async () => {
    const { service, prisma, graphqlClient, syncService } = createService();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);

    graphqlClient.fetchContributions.mockResolvedValue({
      data: {
        user: {
          contributionsCollection: {
            commitContributionsByRepository: { totalCount: 3 },
          },
        },
      },
      rateLimit: {
        remaining: 50,
        resetAt: Date.now() + 1000,
        resource: 'core',
      },
      tokenType: 'oauth',
    });

    syncService.applyContributionSync.mockResolvedValue({
      apDelta: 3,
      log: { id: 'log-1' },
    });

    const result = await service.syncNow('user-1');

    expect(result.apDelta).toBe(3);
    expect(result.contributions).toBe(3);
    expect(syncService.applyContributionSync).toHaveBeenCalledWith(
      expect.objectContaining({
        contributions: 3,
        rateLimitRemaining: 50,
      }),
    );
  });

  it('레이트 리밋이면 실패 로그를 남기고 429를 던진다', async () => {
    const { service, prisma, graphqlClient } = createService();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    prisma.apSyncLog.upsert.mockResolvedValue({});

    graphqlClient.fetchContributions.mockRejectedValue(
      new GithubGraphqlError({
        code: 'RATE_LIMITED',
        message: 'rate limited',
        rateLimit: { remaining: 0, resetAt: Date.now() + 5000 },
      }),
    );

    await expect(service.syncNow('user-1')).rejects.toMatchObject({
      response: {
        error: { code: 'GITHUB_SYNC_RATE_LIMITED' },
      },
      status: 429,
    });

    const upsertArgs = prisma.apSyncLog.upsert.mock.calls[0]?.[0] as
      | Prisma.ApSyncLogUpsertArgs
      | undefined;

    expect(upsertArgs?.update?.status).toBe(ApSyncStatus.FAILED);
    expect(upsertArgs?.update?.errorCode).toBe('GITHUB_SYNC_RATE_LIMITED');
  });
});
