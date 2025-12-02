import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApSyncTokenType } from '@prisma/client';
import { createSchedulerTestbed } from './helpers';

describe('GithubSyncScheduler', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('이전 총합을 meta에서 읽어 델타만 적재한다', async () => {
    const { scheduler, prisma, client, syncService } = createSchedulerTestbed();

    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
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
      log: { id: 'log-1' },
    });

    await scheduler.handleSyncJob();

    expect(syncService.applyContributionSync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
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
        id: 'user-2',
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
});
