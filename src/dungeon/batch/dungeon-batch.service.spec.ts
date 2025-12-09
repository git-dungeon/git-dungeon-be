import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  type DungeonState,
} from '@prisma/client';
import { DungeonBatchService } from './dungeon-batch.service';
import { DungeonEventType } from '../events/event.types';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DungeonEventService } from '../events/dungeon-event.service';
import type { DungeonBatchLockService } from './dungeon-batch.lock.service';
import type { SimpleQueue } from '../../common/queue/simple-queue';

type MockConfigService = Pick<ConfigService, 'get'>;

const createConfigService = (
  overrides?: Record<string, unknown>,
): MockConfigService => {
  const defaults: Record<string, unknown> = {
    'dungeon.batch.cron': '*/5 * * * *',
    'dungeon.batch.maxUsersPerTick': 10,
    'dungeon.batch.maxActionsPerUser': 2,
    'dungeon.batch.minAp': 1,
    'dungeon.batch.inactiveDays': 0,
  };

  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (overrides && key in overrides) return overrides[key];
      if (key in defaults) return defaults[key];
      return defaultValue;
    }),
  };
};

const createState = (overrides: Partial<DungeonState> = {}): DungeonState => ({
  userId: 'user-1',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 1,
  luck: 1,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 2,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  version: 1,
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('DungeonBatchService 배치 동작', () => {
  const prismaMock = {
    dungeonState: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    dungeonLog: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const lockMock = {
    acquire: vi.fn(),
    release: vi.fn(),
  };

  const eventServiceMock = {
    execute: vi.fn(),
  };

  const queueMock = (() => {
    let handler: ((data: { userId: string }) => Promise<void>) | null = null;
    return {
      registerHandler: vi.fn<
        (cb: (data: { userId: string }) => Promise<void>) => void
      >((cb) => {
        handler = cb;
      }),
      enqueue: vi.fn(async (data: { userId: string }) => {
        if (handler) {
          await handler(data);
        }
      }),
      resetHandler: () => {
        handler = null;
      },
    };
  })();

  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    vi.clearAllMocks();
    prismaMock.$transaction?.mockImplementation(
      (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock),
    );
    prismaMock.dungeonState.findUnique.mockResolvedValue(null);
    queueMock.registerHandler.mockClear();
    queueMock.enqueue.mockClear();
    queueMock.resetHandler();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const buildService = (configService: MockConfigService) =>
    new DungeonBatchService(
      prismaMock as unknown as PrismaService,
      eventServiceMock as unknown as DungeonEventService,
      lockMock as unknown as DungeonBatchLockService,
      queueMock as unknown as SimpleQueue<{ userId: string }>,
      undefined,
      configService as unknown as ConfigService,
    );

  it('락을 못 잡으면 사용자 처리를 건너뛴다', async () => {
    const configService = createConfigService();
    const state = createState();
    prismaMock.dungeonState.findMany.mockResolvedValue([state]);
    lockMock.acquire.mockResolvedValue(false);

    const service = buildService(configService);

    await service.runBatchTick();

    expect(eventServiceMock.execute).not.toHaveBeenCalled();
    expect(lockMock.release).not.toHaveBeenCalled();
  });

  it('AP가 최소값보다 적으면 행동을 수행하지 않는다', async () => {
    const configService = createConfigService({
      'dungeon.batch.minAp': 2,
    });
    const state = createState({ ap: 1 });
    prismaMock.dungeonState.findMany.mockResolvedValue([state]);
    lockMock.acquire.mockResolvedValue(true);

    const service = buildService(configService);

    await service.runBatchTick();

    expect(eventServiceMock.execute).not.toHaveBeenCalled();
    expect(prismaMock.dungeonLog.createMany).not.toHaveBeenCalled();
  });

  it('하나의 행동을 실행하고 상태/로그를 저장한다', async () => {
    const configService = createConfigService({
      'dungeon.batch.maxActionsPerUser': 1,
    });
    const state = createState({ ap: 2, version: 3 });
    prismaMock.dungeonState.findMany
      .mockResolvedValueOnce([state]) // primary fetch
      .mockResolvedValueOnce([]); // secondary wrap fetch
    prismaMock.dungeonState.findUnique.mockResolvedValue(state);
    lockMock.acquire.mockResolvedValue(true);
    prismaMock.dungeonState.updateMany.mockResolvedValue({ count: 1 });

    const logCreatedAt = new Date('2025-01-01T00:00:01.000Z');
    eventServiceMock.execute.mockResolvedValue({
      selectedEvent: DungeonEventType.BATTLE,
      forcedMove: false,
      stateBefore: state,
      stateAfter: { ...state, ap: state.ap - 1, version: state.version + 1 },
      rawLogs: [],
      logs: [
        {
          category: DungeonLogCategory.EXPLORATION,
          action: DungeonLogAction.BATTLE,
          status: DungeonLogStatus.COMPLETED,
          floor: state.floor,
          stateVersionBefore: state.version,
          stateVersionAfter: state.version + 1,
          createdAt: logCreatedAt,
        },
      ],
    });

    const service = buildService(configService);

    await service.runBatchTick();

    expect(eventServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(eventServiceMock.execute).toHaveBeenCalledWith({
      state,
      seed: state.userId,
      actionCounter: state.version,
      apCost: 1,
    });
    expect(prismaMock.dungeonState.updateMany).toHaveBeenCalledWith({
      where: { userId: state.userId, version: state.version },
      data: expect.objectContaining({
        ap: state.ap - 1,
        version: 4,
      }) as Record<string, unknown>,
    });
    expect(prismaMock.dungeonLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: state.userId,
          action: DungeonLogAction.BATTLE,
          stateVersionAfter: state.version + 1,
          createdAt: logCreatedAt,
        }),
      ],
    });
    expect(lockMock.release).toHaveBeenCalledWith(state.userId);
  });

  it('커서 기반 라운드 로빈으로 사용자 목록을 순환한다', async () => {
    const configService = createConfigService({
      'dungeon.batch.maxUsersPerTick': 2,
    });
    const user1 = createState({ userId: 'user-1' });
    const user2 = createState({ userId: 'user-2' });
    const user3 = createState({ userId: 'user-3' });

    // First tick: return user1,user2
    prismaMock.dungeonState.findMany.mockImplementationOnce(() =>
      Promise.resolve([user1, user2]),
    );
    lockMock.acquire.mockResolvedValue(true);
    prismaMock.dungeonState.updateMany.mockResolvedValue({ count: 1 });
    eventServiceMock.execute.mockResolvedValue({
      selectedEvent: DungeonEventType.BATTLE,
      forcedMove: false,
      stateBefore: user1,
      stateAfter: { ...user1, ap: user1.ap - 1, version: user1.version + 1 },
      rawLogs: [],
      logs: [],
    });

    const service = buildService(configService);
    await service.runBatchTick();

    // Second tick: cursor after user2, so first call returns user3, then wraps to user1
    prismaMock.dungeonState.findMany.mockImplementationOnce((args: unknown) => {
      const cursorUserId = (args as { cursor?: { userId?: string } }).cursor
        ?.userId;
      if (cursorUserId === 'user-2') {
        return Promise.resolve([user3]);
      }
      return Promise.resolve([]);
    });
    prismaMock.dungeonState.findMany.mockImplementationOnce((args: unknown) => {
      const take = (args as { take?: number }).take ?? 0;
      if (take === 1) {
        return Promise.resolve([user1]);
      }
      return Promise.resolve([]);
    });

    await service.runBatchTick();

    expect(prismaMock.dungeonState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { userId: 'user-2' },
        take: 2,
        skip: 1,
      }),
    );
    expect(prismaMock.dungeonState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );
  });
});
