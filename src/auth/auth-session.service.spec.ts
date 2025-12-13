import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { AuthSessionService } from './auth-session.service';

const createHeaders = (cookies: string[] = []) => {
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append('set-cookie', cookie);
  }

  Object.defineProperty(headers, 'getSetCookie', {
    configurable: true,
    value: () => cookies,
  });

  return headers as Headers & { getSetCookie: () => string[] };
};

const createRequest = (): Request =>
  ({ get: vi.fn(), secure: false } as unknown as Request);

describe('AuthSessionService', () => {
  const betterAuthApiGetSession = vi.fn();
  const prismaFindUnique = vi.fn();
  const prismaCreate = vi.fn();
  const configGet = vi.fn();

  const createService = () => {
    const betterAuth = {
      api: {
        getSession: betterAuthApiGetSession,
        signOut: vi.fn(),
      },
      options: {
        baseURL: 'http://localhost:3000/api/auth',
        advanced: {},
        session: { expiresIn: 60 * 60 },
      },
    } as const;

    const prisma = {
      dungeonState: {
        findUnique: prismaFindUnique,
        create: prismaCreate,
      },
    } as any;

    const configService = {
      get: configGet,
    } as any;

    return new AuthSessionService(betterAuth as any, prisma, configService);
  };

  beforeEach(() => {
    betterAuthApiGetSession.mockReset();
    prismaFindUnique.mockReset();
    prismaCreate.mockReset();
    configGet.mockReset();
  });

  it('DATABASE_SKIP_CONNECTION(=database.skipConnection) 이 true면 DungeonState 보장을 수행하지 않아야 한다', async () => {
    configGet.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'database.skipConnection') return true;
      if (key === 'dungeon.initialAp') return 10;
      return fallback;
    });

    betterAuthApiGetSession.mockResolvedValue({
      response: { session: { userId: 'user-1' }, user: { id: 'user-1' } },
      headers: createHeaders(),
    });

    const service = createService();
    const result = await service.getSession(createRequest());

    expect(result?.view.session.userId).toBe('user-1');
    expect(prismaFindUnique).not.toHaveBeenCalled();
    expect(prismaCreate).not.toHaveBeenCalled();
  });

  it('DungeonState 가 이미 있으면 생성하지 않아야 한다', async () => {
    configGet.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'database.skipConnection') return false;
      if (key === 'dungeon.initialAp') return 10;
      return fallback;
    });

    prismaFindUnique.mockResolvedValue({ userId: 'user-1' });

    betterAuthApiGetSession.mockResolvedValue({
      response: { session: { userId: 'user-1' }, user: { id: 'user-1' } },
      headers: createHeaders(),
    });

    const service = createService();
    await service.getSession(createRequest());

    expect(prismaFindUnique).toHaveBeenCalledTimes(1);
    expect(prismaCreate).not.toHaveBeenCalled();
  });

  it('DungeonState 가 없으면 초기 AP 로 생성해야 한다', async () => {
    configGet.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'database.skipConnection') return false;
      if (key === 'dungeon.initialAp') return 7;
      return fallback;
    });

    prismaFindUnique.mockResolvedValue(null);
    prismaCreate.mockResolvedValue({ userId: 'user-1' });

    betterAuthApiGetSession.mockResolvedValue({
      response: { session: { userId: 'user-1' }, user: { id: 'user-1' } },
      headers: createHeaders(),
    });

    const service = createService();
    await service.getSession(createRequest());

    expect(prismaFindUnique).toHaveBeenCalledTimes(1);
    expect(prismaCreate).toHaveBeenCalledWith({
      data: { userId: 'user-1', ap: 7 },
    });
  });
});
