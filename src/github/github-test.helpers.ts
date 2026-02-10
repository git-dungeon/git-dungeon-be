import { Prisma } from '@prisma/client';
import { vi } from 'vitest';
import { GithubManualSyncService } from './github-sync.manual.service';
import { GithubSyncService } from './github-sync.service';
import { GithubSyncScheduler } from './github-sync.scheduler';
import type { PrismaService } from '../prisma/prisma.service';

type PrismaManualMock = {
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
  githubSyncState: {
    findUnique: ReturnType<
      typeof vi.fn<
        (args: Prisma.GithubSyncStateFindUniqueArgs) => Promise<unknown>
      >
    >;
    upsert: ReturnType<
      typeof vi.fn<(args: Prisma.GithubSyncStateUpsertArgs) => Promise<unknown>>
    >;
  };
};

export const createManualSyncTestbed = () => {
  const prisma: PrismaManualMock = {
    account: {
      findFirst:
        vi.fn<(args: Prisma.AccountFindFirstArgs) => Promise<unknown>>(),
    },
    apSyncLog: {
      findFirst:
        vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>(),
      upsert: vi.fn<(args: Prisma.ApSyncLogUpsertArgs) => Promise<unknown>>(),
    },
    githubSyncState: {
      findUnique:
        vi.fn<
          (args: Prisma.GithubSyncStateFindUniqueArgs) => Promise<unknown>
        >(),
      upsert:
        vi.fn<(args: Prisma.GithubSyncStateUpsertArgs) => Promise<unknown>>(),
    },
  };

  const graphqlClient = {
    fetchContributions: vi.fn(),
    fetchViewerLogin: vi.fn(),
  };

  const lockService = {
    acquire: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    release: vi.fn<() => Promise<void>>(),
  };

  const retryQueue = {
    enqueue: vi.fn<(data: unknown) => Promise<void>>(),
  };

  const syncService = {
    applyContributionSync: vi.fn(),
  };

  const service = new GithubManualSyncService(
    prisma as never,
    graphqlClient as never,
    lockService as never,
    retryQueue as never,
    syncService as never,
  );

  return {
    prisma,
    graphqlClient,
    lockService,
    retryQueue,
    syncService,
    service,
  };
};

type SchedulerPrismaMock = {
  user: {
    findMany: ReturnType<
      typeof vi.fn<(args: Prisma.UserFindManyArgs) => Promise<unknown>>
    >;
  };
  apSyncLog: {
    findFirst: ReturnType<
      typeof vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>
    >;
  };
};

export const createSchedulerTestbed = () => {
  const prisma: SchedulerPrismaMock = {
    user: {
      findMany: vi.fn<(args: Prisma.UserFindManyArgs) => Promise<unknown>>(),
    },
    apSyncLog: {
      findFirst:
        vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>(),
    },
  };

  const client = {
    fetchContributions: vi.fn(),
    fetchViewerLogin: vi.fn(),
  };

  const lockService = {
    acquire: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    release: vi.fn<() => Promise<void>>(),
  };

  const retryQueue = {
    enqueue: vi.fn<() => Promise<void>>(),
  };

  const syncService = {
    applyContributionSync: vi.fn(),
  };

  const configService = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'github.sync.cron') return '0 * * * * *';
      if (key === 'github.sync.batchSize') return 10;
      return defaultValue;
    }),
  };

  const scheduler = new GithubSyncScheduler(
    prisma as never,
    client as never,
    lockService as never,
    retryQueue as never,
    syncService as never,
    undefined,
    configService as never,
  );

  return { scheduler, prisma, client, lockService, retryQueue, syncService };
};

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

type PrismaLike = {
  $transaction: <T>(fn: (tx: MockPrismaTx) => Promise<T> | T) => Promise<T> | T;
};

export const createSyncServiceTestbed = () => {
  const findFirst =
    vi.fn<(args: Prisma.ApSyncLogFindFirstArgs) => Promise<unknown>>();
  const findUnique =
    vi.fn<(args: Prisma.ApSyncLogFindUniqueArgs) => Promise<unknown>>();
  const create =
    vi.fn<(args: Prisma.ApSyncLogCreateArgs) => Promise<unknown>>();
  const update =
    vi.fn<(args: Prisma.ApSyncLogUpdateArgs) => Promise<unknown>>();
  const upsertState =
    vi.fn<(args: Prisma.DungeonStateUpsertArgs) => Promise<unknown>>();
  const upsertSyncState =
    vi.fn<(args: Prisma.GithubSyncStateUpsertArgs) => Promise<unknown>>();

  const tx: MockPrismaTx = {
    apSyncLog: {
      findFirst: findFirst as unknown as MockPrismaTx['apSyncLog']['findFirst'],
      findUnique:
        findUnique as unknown as MockPrismaTx['apSyncLog']['findUnique'],
      create: create as unknown as MockPrismaTx['apSyncLog']['create'],
      update: update as unknown as MockPrismaTx['apSyncLog']['update'],
    },
    dungeonState: {
      upsert: upsertState as unknown as MockPrismaTx['dungeonState']['upsert'],
    },
    githubSyncState: {
      upsert:
        upsertSyncState as unknown as MockPrismaTx['githubSyncState']['upsert'],
    },
  };

  const prisma: PrismaLike = {
    $transaction: <T>(fn: (txArg: MockPrismaTx) => Promise<T> | T) => fn(tx),
  };

  const prismaService = prisma as unknown as PrismaService;
  const service = new GithubSyncService(prismaService);

  return {
    service,
    prisma: prismaService,
    tx,
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
