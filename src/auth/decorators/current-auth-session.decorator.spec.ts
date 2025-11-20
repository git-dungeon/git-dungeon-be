import type { ExecutionContext } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import type { ActiveSessionResult } from '../auth-session.service';
import type { AuthenticatedRequest } from '../auth-session.request';
import { resolveCurrentAuthSession } from './current-auth-session.decorator';

const createHttpContext = (
  request: Partial<AuthenticatedRequest>,
): ExecutionContext => {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request as Request,
    }),
  } as unknown as ExecutionContext;
};

const createNonHttpContext = (): ExecutionContext => {
  return {
    getType: () => 'rpc',
  } as unknown as ExecutionContext;
};

describe('resolveCurrentAuthSession', () => {
  const session = {
    cookies: [],
    payload: {
      session: {},
      user: {},
    },
    refreshed: false,
    view: {
      refreshed: false,
      session: {
        avatarUrl: '',
        displayName: '',
        email: '',
        userId: 'user-1',
        username: '',
      },
    },
  } satisfies ActiveSessionResult;

  it('Guard에서 주입한 세션을 반환해야 한다', () => {
    const context = createHttpContext({ authSession: session });

    const result = resolveCurrentAuthSession(context);

    expect(result).toBe(session);
  });

  it('세션이 없으면 예외를 던져야 한다', () => {
    const context = createHttpContext({});

    expect(() => resolveCurrentAuthSession(context)).toThrowError(
      InternalServerErrorException,
    );
  });

  it('optional=true일 때 세션이 없으면 null을 반환해야 한다', () => {
    const context = createHttpContext({});

    const result = resolveCurrentAuthSession(context, { optional: true });

    expect(result).toBeNull();
  });

  it('HTTP 컨텍스트가 아닐 경우 예외를 던져야 한다', () => {
    const context = createNonHttpContext();

    expect(() => resolveCurrentAuthSession(context)).toThrowError(
      InternalServerErrorException,
    );
  });
});
