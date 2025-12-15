import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApSyncTokenType } from '@prisma/client';
import { createSchedulerTestbed } from './helpers';

describe('GithubSyncScheduler', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
  const USER_ID_2 = '00000000-0000-4000-8000-000000000002';
  const USER_ID_3 = '00000000-0000-4000-8000-000000000003';
  const LOG_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('이전 총합을 meta에서 읽어 델타만 적재한다', async () => {
    const { scheduler, prisma, client, syncService } = createSchedulerTestbed();

    prisma.user.findMany.mockResolvedValue([
      {
        id: USER_ID_1,
        accounts: [
          {
            accountId: 'octocat',
            accessToken: 'token',
            updatedAt: new Date('2025-11-28T00:00:00Z'),
          },
        ],
      },
    ]);

    prisma.apSyncLog.findFirst.mockResolvedValue({
      windowStart: new Date('2025-11-28T00:00:00Z'),
      windowEnd: new Date('2025-11-28T12:00:00Z'),
      meta: {
        anchorFrom: '2025-11-28T00:00:00.000Z',
        totals: { contributions: 3 },
      },
    });

    client.fetchContributions.mockResolvedValue({
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
      rateLimit: { remaining: 50, resetAt: Date.now() + 1000 },
      tokenType: 'oauth',
    });

    syncService.applyContributionSync.mockResolvedValue({
      apDelta: 2,
      log: { id: LOG_ID_1 },
    });

    await scheduler.handleSyncJob();

    expect(syncService.applyContributionSync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID_1,
        contributions: 2, // 5 - prevTotal(3)
        tokenType: ApSyncTokenType.OAUTH,
      }),
    );
  });

  it('락을 획득하지 못하면 스킵한다', async () => {
    const { scheduler, prisma, client, lockService, syncService } =
      createSchedulerTestbed();

    prisma.user.findMany.mockResolvedValue([
      {
        id: USER_ID_2,
        accounts: [
          {
            accountId: 'octocat',
            accessToken: 'token',
            updatedAt: new Date('2025-11-28T00:00:00Z'),
          },
        ],
      },
    ]);
    lockService.acquire.mockResolvedValue(false);

    await scheduler.handleSyncJob();

    expect(client.fetchContributions).not.toHaveBeenCalled();
    expect(syncService.applyContributionSync).not.toHaveBeenCalled();
    expect(lockService.release).not.toHaveBeenCalled();
  });

  it('레이트 리밋 오류 시 재시도 큐에 등록한다', async () => {
    const { scheduler, prisma, client, retryQueue } = createSchedulerTestbed();

    prisma.user.findMany.mockResolvedValue([
      {
        id: USER_ID_3,
        accounts: [
          {
            accountId: 'octocat',
            accessToken: 'token',
            updatedAt: new Date('2025-11-28T00:00:00Z'),
          },
        ],
      },
    ]);

    client.fetchContributions.mockRejectedValue(
      Object.assign(new Error('rate limited'), {
        code: 'RATE_LIMITED',
        rateLimit: { resetAt: Date.now() + 5000 },
      }),
    );

    await scheduler.handleSyncJob();

    expect(retryQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID_3,
        reason: 'RATE_LIMITED',
      }),
    );
  });
});
