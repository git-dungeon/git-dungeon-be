import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { LogsService } from './logs.service';

describe('LogsService', () => {
  const USER_ID = '00000000-0000-4000-8000-000000000001';

  const prismaMock = {
    dungeonLog: {
      findMany: vi.fn(),
    },
  };

  const service = new LogsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.dungeonLog.findMany.mockReset();
  });

  it('from/to가 있으면 createdAt 범위 필터를 포함한다', async () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');
    prismaMock.dungeonLog.findMany.mockResolvedValue([]);

    await service.getLogs({ userId: USER_ID, limit: 10, from, to });

    expect(prismaMock.dungeonLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          userId: USER_ID,
          createdAt: {
            gte: from,
            lte: to,
          },
        }),
      }),
    );
  });

  it('from/to가 없으면 createdAt 필터를 포함하지 않는다', async () => {
    prismaMock.dungeonLog.findMany.mockResolvedValue([]);

    await service.getLogs({ userId: USER_ID, limit: 10 });

    const call = prismaMock.dungeonLog.findMany.mock.calls[0]?.[0] as
      | { where?: Record<string, unknown> }
      | undefined;
    expect(call?.where).toBeDefined();
    expect(call?.where && 'createdAt' in call.where).toBe(false);
  });
});
