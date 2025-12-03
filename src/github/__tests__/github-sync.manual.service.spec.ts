import { BadRequestException } from '@nestjs/common';
import { ApSyncStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubGraphqlError } from '../github.interfaces';
import { createManualSyncTestbed } from './helpers';

describe('GithubManualSyncService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GitHub 계정이 없으면 400을 반환한다', async () => {
    const { service, prisma } = createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue(null);
    prisma.apSyncLog.findFirst.mockResolvedValue(null);

    await expect(service.syncNow('user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.apSyncLog.upsert).not.toHaveBeenCalled();
  });

  it('최근 6시간 내 실행 이력이 있으면 막는다', async () => {
    const { service, prisma, graphqlClient } = createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

    await expect(service.syncNow('user-1')).rejects.toMatchObject({
      response: {
        error: { code: 'GITHUB_SYNC_TOO_FREQUENT' },
      },
      status: 429,
    });
  });

  it('동일 사용자 락이 있으면 409를 반환한다', async () => {
    const { service, prisma, lockService, graphqlClient } =
      createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');
    lockService.acquire.mockResolvedValue(false);

    await expect(service.syncNow('user-lock')).rejects.toMatchObject({
      status: 409,
      response: { error: { code: 'GITHUB_SYNC_IN_PROGRESS' } },
    });
    expect(lockService.release).not.toHaveBeenCalled();
  });

  it('성공 시 기여 수를 계산해 AP 적재를 호출한다', async () => {
    const { service, prisma, graphqlClient, syncService } =
      createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

    graphqlClient.fetchContributions.mockResolvedValue({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 1,
            restrictedContributionsCount: 0,
            pullRequestContributions: { totalCount: 1 },
            pullRequestReviewContributions: { totalCount: 1 },
            issueContributions: { totalCount: 0 },
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

  it('이전 윈도우 총합이 더 커도 신규 윈도우의 총합을 그대로 사용한다', async () => {
    const { service, prisma, graphqlClient, syncService } =
      createManualSyncTestbed();
    const lastWindowEnd = new Date('2025-11-28T12:00:00Z');

    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: lastWindowEnd,
    });
    prisma.apSyncLog.findFirst.mockResolvedValue({
      windowEnd: lastWindowEnd,
    });
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

    graphqlClient.fetchContributions.mockResolvedValue({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 1,
            restrictedContributionsCount: 0,
            pullRequestContributions: { totalCount: 0 },
            pullRequestReviewContributions: { totalCount: 0 },
            issueContributions: { totalCount: 1 },
          },
        },
      },
      rateLimit: {
        remaining: 40,
        resetAt: Date.now() + 5000,
        resource: 'core',
      },
      tokenType: 'oauth',
    });

    syncService.applyContributionSync.mockResolvedValue({
      apDelta: 2,
      log: { id: 'log-2' },
    });

    const result = await service.syncNow('user-2');

    expect(result.contributions).toBe(2);
    const callArg = syncService.applyContributionSync.mock.calls[0]?.[0] as {
      contributions: number;
      windowStart: Date;
      windowEnd: Date;
    };
    expect(callArg.contributions).toBe(2);
    expect(callArg.windowStart).toBeInstanceOf(Date);
    expect(callArg.windowEnd).toBeInstanceOf(Date);
  });

  it('같은 앵커에서 재동기화 시 직전 총합을 차감해 중복을 막는다', async () => {
    const { service, prisma, graphqlClient, syncService } =
      createManualSyncTestbed();

    const anchor = new Date('2025-11-28T00:00:00Z');
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-30T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue({
      windowStart: anchor,
      windowEnd: new Date('2025-12-01T00:00:00Z'),
      meta: { anchorFrom: anchor.toISOString(), totals: { contributions: 4 } },
    });
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

    graphqlClient.fetchContributions.mockResolvedValue({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 5,
            restrictedContributionsCount: 0,
            pullRequestContributions: { totalCount: 0 },
            pullRequestReviewContributions: { totalCount: 0 },
            issueContributions: { totalCount: 0 },
          },
        },
      },
      rateLimit: { remaining: 30, resetAt: Date.now() + 1000 },
      tokenType: 'oauth',
    });

    syncService.applyContributionSync.mockResolvedValue({
      apDelta: 1,
      log: { id: 'log-3' },
    });

    const result = await service.syncNow('user-3');

    expect(result.contributions).toBe(1); // 5 - prevTotal 4
    const callArg = syncService.applyContributionSync.mock.calls[0]?.[0] as {
      contributions: number;
      windowStart: Date;
      windowEnd: Date;
    };
    expect(callArg.contributions).toBe(1);
    expect(callArg.windowStart).toBeInstanceOf(Date);
    expect(callArg.windowEnd).toBeInstanceOf(Date);
  });

  it('rate limit/토큰 메타를 로그 메타에 포함한다', async () => {
    const { service, prisma, graphqlClient, syncService } =
      createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

    graphqlClient.fetchContributions.mockResolvedValue({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 1,
            restrictedContributionsCount: 0,
            pullRequestContributions: { totalCount: 1 },
            pullRequestReviewContributions: { totalCount: 0 },
            issueContributions: { totalCount: 0 },
          },
        },
      },
      rateLimit: {
        remaining: 10,
        resetAt: Date.now() + 1000,
        resource: 'core',
      },
      tokenType: 'oauth',
      tokensTried: ['oauth', 'pat'],
      attempts: 2,
      backoffMs: 1500,
    });

    syncService.applyContributionSync.mockResolvedValue({
      apDelta: 2,
      log: { id: 'log-meta' },
    });

    await service.syncNow('user-meta');

    const callArg = syncService.applyContributionSync.mock.calls[0]?.[0] as {
      meta?: Record<string, unknown>;
    };
    expect(callArg.meta?.tokensTried).toEqual(['oauth', 'pat']);
    expect(callArg.meta?.attempts).toBe(2);
    expect(callArg.meta?.backoffMs).toBe(1500);
  });

  it('레이트 리밋이면 실패 로그를 남기고 429를 던진다', async () => {
    const { service, prisma, graphqlClient } = createManualSyncTestbed();
    prisma.account.findFirst.mockResolvedValue({
      accountId: 'octocat',
      accessToken: 'token',
      updatedAt: new Date('2025-11-20T00:00:00Z'),
    });
    prisma.apSyncLog.findFirst.mockResolvedValue(null);
    prisma.apSyncLog.upsert.mockResolvedValue({});
    graphqlClient.fetchViewerLogin.mockResolvedValue('octocat');

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

    const upsertArgs = prisma.apSyncLog.upsert.mock.calls[0]?.[0];
    expect(upsertArgs).toBeDefined();
    expect(upsertArgs?.update?.status).toBe(ApSyncStatus.FAILED);
    expect(upsertArgs?.update?.errorCode).toBe('GITHUB_SYNC_RATE_LIMITED');
  });
});
