import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Request } from 'express';
import type { Auth } from 'better-auth';
import { AuthSessionService } from './auth-session.service';
import {
  AuthSessionExpiredException,
  AuthSessionInvalidException,
} from './errors/auth-session.exception';

type GitDungeonAuth = Auth<any>;
type GetSessionArgs = Parameters<GitDungeonAuth['api']['getSession']>;

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

const createRequest = (headers: Record<string, string> = {}): Request => {
  const lowerCased = Object.entries(headers).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    },
    {},
  );

  return {
    get: (name: string) => lowerCased[name.toLowerCase()],
    headers: lowerCased,
    secure: false,
  } as unknown as Request;
};

describe('AuthSessionService', () => {
  const getSessionMock = vi
    .fn()
    .mockResolvedValue({ response: null, headers: createHeaders() });

  const betterAuthStub = {
    options: {
      advanced: {},
      session: {
        expiresIn: 60 * 60,
      },
    },
    api: {
      getSession: getSessionMock,
    },
  } as unknown as GitDungeonAuth;

  const createService = () => new AuthSessionService(betterAuthStub);

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      response: null,
      headers: createHeaders(),
    });
  });

  it('세션을 조회해 성공적으로 반환해야 한다', async () => {
    const cookies = ['better-auth.session_token=abc; Path=/; HttpOnly'];
    const payload = {
      session: { id: 'sess', userId: 'user', expiresAt: new Date() },
      user: { id: 'user', email: 'user@example.com' },
    };

    getSessionMock.mockResolvedValue({
      response: payload,
      headers: createHeaders(cookies),
    });

    const service = createService();
    const request = createRequest({ cookie: cookies[0] });

    const result = await service.getSession(request);

    expect(result).not.toBeNull();
    expect(result?.payload).toEqual(payload);
    expect(result?.cookies).toEqual(cookies);
    expect(result?.refreshed).toBe(true);
    expect(result?.view).toEqual({
      session: {
        userId: 'user',
        username: null,
        displayName: null,
        email: 'user@example.com',
        avatarUrl: null,
      },
      refreshed: true,
    });

    const lastCall = getSessionMock.mock.calls.at(-1) as
      | GetSessionArgs
      | undefined;
    expect(lastCall).toBeDefined();
    const [callArgs] = lastCall!;
    expect(callArgs.headers).toBeInstanceOf(Headers);
    expect(callArgs.query).toEqual({
      disableCookieCache: false,
      disableRefresh: false,
    });
    expect(callArgs.returnHeaders).toBe(true);
  });

  it('세션이 없고 쿠키가 존재하면 만료 예외를 던져야 한다', async () => {
    getSessionMock.mockResolvedValue({
      response: null,
      headers: createHeaders(),
    });

    const service = createService();
    const request = createRequest({
      cookie: 'better-auth.session_token=stale; Path=/; HttpOnly',
    });

    await expect(service.requireActiveSession(request)).rejects.toBeInstanceOf(
      AuthSessionExpiredException,
    );
  });

  it('세션이 없고 쿠키가 없으면 무효 예외를 던져야 한다', async () => {
    getSessionMock.mockResolvedValue({
      response: null,
      headers: createHeaders(),
    });

    const service = createService();
    const request = createRequest();

    await expect(service.requireActiveSession(request)).rejects.toBeInstanceOf(
      AuthSessionInvalidException,
    );
  });

  it('쿠키 구성을 설명해야 한다', () => {
    const service = createService();
    const cookies = service.describeSessionCookies();

    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.path).toBe('/');
    }
  });
});
