import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import type { Auth } from 'better-auth';
import type { ConfigService } from '@nestjs/config';
import { AuthSessionService } from './auth-session.service';
import type { PrismaService } from '../prisma/prisma.service';

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
  ({ get: vi.fn(), secure: false }) as unknown as Request;

describe('AuthSessionService', () => {
  const betterAuthApiGetSession = vi.fn();
  const prismaFindUnique = vi.fn();
  const prismaCreate = vi.fn();
  const prismaCreateMany = vi.fn();
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
    };

    const prisma = {
      dungeonState: {
        findUnique: prismaFindUnique,
        create: prismaCreate,
        createMany: prismaCreateMany,
      },
    };

    const configService = {
      get: configGet,
    };

    return new AuthSessionService(
      betterAuth as unknown as Auth<any>,
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  };

  beforeEach(() => {
    betterAuthApiGetSession.mockReset();
    prismaFindUnique.mockReset();
    prismaCreate.mockReset();
    prismaCreateMany.mockReset();
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
      headers: createHeaders(['better-auth.session_token=renewed; Path=/']),
    });

    const service = createService();
    const result = await service.getSession(createRequest());

    expect(result?.view.session.userId).toBe('user-1');
    expect(prismaCreateMany).not.toHaveBeenCalled();
  });

  it('세션 refreshed 시 createMany(skipDuplicates) 로 DungeonState 를 보장해야 한다', async () => {
    configGet.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'database.skipConnection') return false;
      if (key === 'dungeon.initialAp') return 10;
      return fallback;
    });

    betterAuthApiGetSession.mockResolvedValue({
      response: { session: { userId: 'user-1' }, user: { id: 'user-1' } },
      headers: createHeaders(['better-auth.session_token=renewed; Path=/']),
    });

    const service = createService();
    await service.getSession(createRequest());

    expect(prismaCreateMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', ap: 10 }],
      skipDuplicates: true,
    });
  });

  it('초기 AP 설정값으로 create payload 를 구성해야 한다', async () => {
    configGet.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'database.skipConnection') return false;
      if (key === 'dungeon.initialAp') return 7;
      return fallback;
    });

    betterAuthApiGetSession.mockResolvedValue({
      response: { session: { userId: 'user-1' }, user: { id: 'user-1' } },
      headers: createHeaders(['better-auth.session_token=renewed; Path=/']),
    });

    const service = createService();
    await service.getSession(createRequest());

    expect(prismaCreateMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', ap: 7 }],
      skipDuplicates: true,
    });
  });
});
