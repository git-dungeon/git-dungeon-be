import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { APIError } from 'better-auth';
import { AppModule } from '../app.module.js';
import { BETTER_AUTH_TOKEN } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

vi.mock('typia', () => ({
  __esModule: true,
  default: {
    assert: <T>(value: T) => value,
  },
  assert: <T>(value: T) => value,
}));

vi.mock('@nestia/core', async () => {
  const decorators = await import('@nestjs/common');

  const wrap =
    <T extends (...params: never[]) => unknown>(decorator: T) =>
    (...params: Parameters<T>): ReturnType<T> =>
      decorator(...params) as ReturnType<T>;

  return {
    __esModule: true,
    TypedRoute: {
      Get: wrap(decorators.Get),
      Post: wrap(decorators.Post),
      Put: wrap(decorators.Put),
      Patch: wrap(decorators.Patch),
      Delete: wrap(decorators.Delete),
    },
    TypedBody: wrap(decorators.Body),
    TypedParam: wrap(decorators.Param),
    TypedQuery: wrap(decorators.Query),
    TypedHeaders: wrap(decorators.Headers),
  } as const;
});

const setupTestEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_GITHUB_CLIENT_ID = 'test-client-id';
  process.env.AUTH_GITHUB_CLIENT_SECRET = 'test-client-secret';
  process.env.AUTH_GITHUB_REDIRECT_URI =
    'http://localhost:3000/api/auth/callback/github';
  process.env.AUTH_GITHUB_SCOPE = 'read:user,user:email';
  process.env.DATABASE_SKIP_CONNECTION = 'true';
};

const decodeFlowCookie = (cookie: string) => {
  const [cookieValuePart] = cookie.split(';', 1);
  const [, encodedValue = ''] = cookieValuePart.split('=');
  if (!encodedValue) {
    return null;
  }

  return JSON.parse(decodeURIComponent(encodedValue)) as {
    redirect: string;
    popup: boolean;
    parent: string | null;
  };
};

describe('AuthController (E2E) 시나리오', () => {
  const originalEnv = Object.entries(process.env).reduce<
    Record<string, string | undefined>
  >((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
  let app: INestApplication;
  let signInSocialMock: ReturnType<typeof vi.fn>;
  let callbackOAuthMock: ReturnType<typeof vi.fn>;
  let getSessionMock: ReturnType<typeof vi.fn>;
  let handlerMock: ReturnType<typeof vi.fn>;

  const createAgent = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  beforeAll(async () => {
    setupTestEnv();

    const stubAuthorizeHeaders = new Headers();
    const stateCookieValue =
      'better-auth.state=stub-state; Path=/; HttpOnly; SameSite=Lax';
    stubAuthorizeHeaders.append('set-cookie', stateCookieValue);
    Object.defineProperty(stubAuthorizeHeaders, 'getSetCookie', {
      configurable: true,
      value: () => [stateCookieValue],
    });

    const stubCallbackHeaders = new Headers();
    const sessionCookieValue =
      'better-auth.session=stub-session-token; Path=/; HttpOnly; SameSite=Lax';
    const refreshCookieValue =
      'better-auth.refresh=stub-refresh-token; Path=/; HttpOnly; SameSite=Lax';
    stubCallbackHeaders.append('set-cookie', sessionCookieValue);
    stubCallbackHeaders.append('set-cookie', refreshCookieValue);
    Object.defineProperty(stubCallbackHeaders, 'getSetCookie', {
      configurable: true,
      value: () => [sessionCookieValue, refreshCookieValue],
    });

    handlerMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 404 })),
    );

    const stubAuth = {
      handler: handlerMock,
      api: {
        signInSocial: vi.fn().mockResolvedValue({
          headers: stubAuthorizeHeaders,
          response: {
            url: 'https://github.com/login/oauth/authorize?client_id=test-client-id',
          },
        }),
        callbackOAuth: vi.fn().mockResolvedValue({
          headers: stubCallbackHeaders,
          response: undefined,
        }),
        getSession: vi.fn().mockResolvedValue({
          session: {
            id: 'session-1',
            token: 'stub-session-token',
            userId: 'user-123',
            createdAt: new Date('2025-10-19T00:00:00.000Z'),
            updatedAt: new Date('2025-10-19T00:00:00.000Z'),
            expiresAt: new Date('2025-10-26T00:00:00.000Z'),
            ipAddress: null,
            userAgent: null,
          },
          user: {
            id: 'user-123',
            email: 'mock-user@example.com',
            name: 'Mocked Adventurer',
            image: 'https://avatars.githubusercontent.com/u/1?v=4',
            createdAt: new Date('2025-10-19T00:00:00.000Z'),
            updatedAt: new Date('2025-10-19T00:00:00.000Z'),
            emailVerified: true,
          },
        }),
      },
    } as const;

    signInSocialMock = stubAuth.api.signInSocial;
    callbackOAuthMock = stubAuth.api.callbackOAuth;
    getSessionMock = stubAuth.api.getSession;

    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    moduleBuilder.overrideProvider(BETTER_AUTH_TOKEN).useValue(stubAuth);

    const moduleRef = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    app.useLogger(app.get(Logger));
    await app.init();

    const injected = app.get<typeof stubAuth>(BETTER_AUTH_TOKEN);
    expect(injected).toBe(stubAuth);
    const controller = app.get<AuthController>(AuthController);
    const service = app.get<AuthService>(AuthService);
    (controller as unknown as { authService: AuthService }).authService =
      service;
  });

  beforeEach(() => {
    signInSocialMock.mockClear();
    callbackOAuthMock.mockClear();
    getSessionMock.mockClear();
    handlerMock.mockClear();
  });

  afterAll(async () => {
    await app?.close();

    for (const key of Object.keys(process.env)) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    }
    Object.assign(process.env, originalEnv);
  });

  it('GET /auth/github 요청 시 안전한 redirect 경로로 GitHub OAuth로 이동해야 한다', async () => {
    const response = await createAgent()
      .get('/auth/github?redirect=%2Fdashboard')
      .redirects(0);

    expect(response.status).toBe(302);
    const locationHeader = response.headers.location;
    expect(locationHeader).toBe(
      'https://github.com/login/oauth/authorize?client_id=test-client-id',
    );

    expect(signInSocialMock).toHaveBeenCalledTimes(1);
    const callArgs = signInSocialMock.mock.calls[0]?.[0] as {
      body: { provider: string; callbackURL: string; disableRedirect: boolean };
      headers: Headers;
    };
    expect(callArgs).toBeDefined();
    expect(callArgs.body.provider).toBe('github');
    expect(callArgs.body.disableRedirect).toBe(true);

    const callbackUrl = new URL(callArgs.body.callbackURL);
    expect(callbackUrl.searchParams.get('redirect')).toBe('/dashboard');

    const cookieHeader = response.headers['set-cookie'];
    const cookies: string[] = Array.isArray(cookieHeader)
      ? cookieHeader
      : cookieHeader
        ? [cookieHeader]
        : [];

    expect(
      cookies.some((cookie) => cookie.includes('better-auth.state=stub-state')),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith('better-auth.redirect=')),
    ).toBe(true);
    const flowCookie = cookies.find((cookie) =>
      cookie.startsWith('better-auth.flow='),
    );
    expect(flowCookie).toBeDefined();
    if (flowCookie) {
      const parsed = decodeFlowCookie(flowCookie);
      expect(parsed).not.toBeNull();
      expect(parsed?.redirect).toBe('/dashboard');
      expect(parsed?.popup).toBe(false);
      expect(parsed?.parent).toBeNull();
    }
  });

  it('GET /auth/github 요청 시 허용되지 않은 redirect 는 400 오류를 반환해야 한다', async () => {
    const response = await createAgent()
      .get('/auth/github?redirect=https://malicious.example.com')
      .redirects(0);

    expect(response.status).toBe(400);
    expect(signInSocialMock).not.toHaveBeenCalled();

    const payload = response.body as {
      success?: boolean;
      error?: { code?: string };
    };

    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe('AUTH_REDIRECT_INVALID');
  });

  it('GET /auth/github 요청 시 popup 모드 정보는 callback URL에 반영돼야 한다', async () => {
    const response = await createAgent()
      .get('/auth/github?popup=1&parent=http://malicious.example.com')
      .redirects(0);

    expect(response.status).toBe(302);

    expect(signInSocialMock).toHaveBeenCalledTimes(1);
    const callArgs = signInSocialMock.mock.calls[0]?.[0] as {
      body: { callbackURL: string };
    };
    expect(callArgs).toBeDefined();

    const callbackUrl = new URL(callArgs.body.callbackURL);
    expect(callbackUrl.searchParams.get('popup')).toBe('1');
    expect(callbackUrl.searchParams.get('parent')).toBeNull();

    const cookieHeader = response.headers['set-cookie'];
    const cookies: string[] = Array.isArray(cookieHeader)
      ? cookieHeader
      : typeof cookieHeader === 'string'
        ? [cookieHeader]
        : [];
    const flowCookie = cookies.find((cookie) =>
      cookie.startsWith('better-auth.flow='),
    );
    expect(flowCookie).toBeDefined();
    if (flowCookie) {
      const parsed = decodeFlowCookie(flowCookie);
      expect(parsed).not.toBeNull();
      expect(parsed?.popup).toBe(true);
      expect(parsed?.parent).toBeNull();
    }
  });

  it('POST /auth/github 요청 시 팝업 플로우 결과를 반환해야 한다', async () => {
    const response = await createAgent()
      .post('/auth/github')
      .set('Cookie', [
        'better-auth.state=stub-state',
        'better-auth.redirect=%2Fdashboard',
        `better-auth.flow=${encodeURIComponent(
          JSON.stringify({
            redirect: '/dashboard',
            popup: false,
            parent: null,
          }),
        )}`,
      ])
      .send({
        code: 'stub-code',
        state: 'stub-state',
      });

    expect(response.status).toBe(200);
    expect(callbackOAuthMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).toHaveBeenCalledTimes(1);

    const payload = response.body as {
      success?: boolean;
      data?: {
        redirect?: string;
        session?: { userId?: string; username?: string; displayName?: string };
        accessToken?: string;
      };
      meta?: { generatedAt?: string };
    };

    expect(payload.success).toBe(true);
    expect(payload.data?.redirect).toBe('/dashboard');
    expect(payload.data?.session?.userId).toBe('user-123');
    expect(payload.data?.session?.username).toBe('Mocked Adventurer');
    expect(payload.data?.accessToken).toBe('stub-session-token');
    expect(payload.meta?.generatedAt).toBeTruthy();

    const cookieHeader = response.headers['set-cookie'];
    const cookies: string[] = Array.isArray(cookieHeader)
      ? cookieHeader
      : typeof cookieHeader === 'string'
        ? [cookieHeader]
        : [];
    expect(
      cookies.some((cookie) =>
        cookie.includes('better-auth.session=stub-session-token'),
      ),
    ).toBe(true);
    expect(
      cookies.some((cookie) =>
        cookie.includes('better-auth.refresh=stub-refresh-token'),
      ),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith('better-auth.redirect=')),
    ).toBe(true);
    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith('better-auth.flow=') &&
          cookie.includes('Max-Age=0'),
      ),
    ).toBe(true);

    const callbackArgs = callbackOAuthMock.mock.calls[0]?.[0] as {
      body: { code: string; state: string };
    };
    expect(callbackArgs.body.code).toBe('stub-code');
    expect(callbackArgs.body.state).toBe('stub-state');
  });

  it('POST /auth/github 요청 시 state 누락이면 400 오류가 발생해야 한다', async () => {
    const response = await createAgent()
      .post('/auth/github')
      .set('Cookie', [
        'better-auth.state=stub-state',
        `better-auth.flow=${encodeURIComponent(
          JSON.stringify({
            redirect: '/dashboard',
            popup: false,
            parent: null,
          }),
        )}`,
      ])
      .send({ code: 'stub-code' });

    expect(response.status).toBe(400);
    expect(callbackOAuthMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();

    const payload = response.body as {
      success?: boolean;
      error?: { code?: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe('AUTH_REDIRECT_INVALID');
  });

  it('POST /auth/github 요청 시 GitHub 에서 거부되면 401 오류가 반환돼야 한다', async () => {
    const response = await createAgent()
      .post('/auth/github')
      .set('Cookie', [
        'better-auth.state=stub-state',
        `better-auth.flow=${encodeURIComponent(
          JSON.stringify({
            redirect: '/dashboard',
            popup: false,
            parent: null,
          }),
        )}`,
      ])
      .send({
        code: 'stub-code',
        state: 'stub-state',
        error: 'access_denied',
        errorDescription: 'User cancelled',
      });

    expect(response.status).toBe(401);
    expect(callbackOAuthMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();

    const payload = response.body as {
      success?: boolean;
      error?: { code?: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe('AUTH_PROVIDER_DENIED');
  });

  it('POST /auth/github 요청 시 better-auth 콜백 오류는 500으로 매핑해야 한다', async () => {
    callbackOAuthMock.mockRejectedValueOnce(
      new APIError('BAD_REQUEST', { message: 'provider error' }),
    );

    const response = await createAgent()
      .post('/auth/github')
      .set('Cookie', [
        'better-auth.state=stub-state',
        'better-auth.redirect=%2Fdashboard',
        `better-auth.flow=${encodeURIComponent(
          JSON.stringify({
            redirect: '/dashboard',
            popup: false,
            parent: null,
          }),
        )}`,
      ])
      .send({ code: 'stub-code', state: 'stub-state' });

    expect(response.status).toBe(500);
    expect(callbackOAuthMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).not.toHaveBeenCalled();

    const payload = response.body as {
      success?: boolean;
      error?: { code?: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe('AUTH_PROVIDER_ERROR');
  });
});
