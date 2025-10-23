import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthSessionService } from '../auth-session.service';
import type { ActiveSessionResult } from '../auth-session.service';
import {
  AuthSessionExpiredException,
  AuthSessionInvalidException,
} from '../errors/auth-session.exception';

const createHttpContext = (request: Request): ExecutionContext => {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

const createNonHttpContext = (): ExecutionContext => {
  return {
    getType: () => 'rpc',
  } as unknown as ExecutionContext;
};

describe('AuthGuard', () => {
  const requireActiveSession =
    vi.fn<(request: Request) => Promise<ActiveSessionResult>>();

  const createGuard = () =>
    new AuthGuard({
      requireActiveSession,
    } as unknown as AuthSessionService);

  beforeEach(() => {
    requireActiveSession.mockReset();
  });

  it('HTTP 컨텍스트가 아니면 통과시켜야 한다', async () => {
    const guard = createGuard();
    const context = createNonHttpContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(requireActiveSession).not.toHaveBeenCalled();
  });

  it('세션 검증 후 요청에 주입해야 한다', async () => {
    const guard = createGuard();
    const request = { headers: {}, get: vi.fn() } as unknown as Request;
    const context = createHttpContext(request);
    const activeSession = {
      cookies: ['better-auth.session=abc; Path=/; HttpOnly'],
      payload: {
        session: { userId: 'user-1' },
        user: { id: 'user-1' },
      },
      refreshed: false,
      view: {
        refreshed: false,
        session: {
          avatarUrl: null,
          displayName: null,
          email: null,
          userId: 'user-1',
          username: null,
        },
      },
    } satisfies ActiveSessionResult;

    requireActiveSession.mockResolvedValue(activeSession);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(requireActiveSession).toHaveBeenCalledWith(request);
    expect(request.authSession).toBe(activeSession);
  });

  it('이미 세션이 존재하면 추가 호출 없이 통과해야 한다', async () => {
    const existingSession = {
      cookies: [],
      payload: { session: { userId: 'user-1' }, user: {} },
      refreshed: false,
      view: {
        refreshed: false,
        session: {
          avatarUrl: null,
          displayName: null,
          email: null,
          userId: 'user-1',
          username: 'rogue',
        },
      },
    } satisfies ActiveSessionResult;

    const guard = createGuard();
    const request = {
      headers: {},
      get: vi.fn(),
      authSession: existingSession,
    } as unknown as Request & { authSession: ActiveSessionResult };
    const context = createHttpContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(requireActiveSession).not.toHaveBeenCalled();
    expect(request.authSession).toBe(existingSession);
  });

  it('만료된 세션이면 예외를 전파해야 한다', async () => {
    const guard = createGuard();
    const request = { headers: {}, get: vi.fn() } as unknown as Request;
    const context = createHttpContext(request);
    const error = new AuthSessionExpiredException();

    requireActiveSession.mockRejectedValue(error);

    await expect(guard.canActivate(context)).rejects.toBe(error);
  });

  it('무효 세션이면 예외를 전파해야 한다', async () => {
    const guard = createGuard();
    const request = { headers: {}, get: vi.fn() } as unknown as Request;
    const context = createHttpContext(request);
    const error = new AuthSessionInvalidException();

    requireActiveSession.mockRejectedValue(error);

    await expect(guard.canActivate(context)).rejects.toBe(error);
  });
});
