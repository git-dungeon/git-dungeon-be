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

describe('AuthController (E2E)', () => {
  const originalEnv = Object.entries(process.env).reduce<
    Record<string, string | undefined>
  >((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
  let app: INestApplication;
  let signInSocialMock: ReturnType<typeof vi.fn>;
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
            redirect: true,
          },
        }),
      },
      options: {
        baseURL: 'http://localhost:3000/api/auth',
        advanced: {},
        session: {
          expiresIn: 60 * 60,
        },
      },
    } as const;

    signInSocialMock = stubAuth.api.signInSocial;

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
    handlerMock.mockClear();
  });

  afterAll(async () => {
    await app?.close();

    for (const key of Object.keys(process.env)) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    }
    Object.assign(process.env, originalEnv);
  });

  it('GET /auth/github 요청 시 better-auth 기본 리다이렉트 플로우로 GitHub OAuth로 이동해야 한다', async () => {
    const response = await createAgent()
      .get('/auth/github?redirect=%2Fdashboard')
      .set('Referer', 'http://localhost:4173/login')
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      'https://github.com/login/oauth/authorize?client_id=test-client-id',
    );

    expect(signInSocialMock).toHaveBeenCalledTimes(1);
    const callArgs = signInSocialMock.mock.calls[0]?.[0] as {
      body: {
        callbackURL: string;
        errorCallbackURL: string;
        provider: string;
        disableRedirect?: boolean;
      };
    };
    expect(callArgs).toBeDefined();
    expect(callArgs.body.provider).toBe('github');
    expect(callArgs.body.disableRedirect).toBeUndefined();

    const callbackUrl = new URL(callArgs.body.callbackURL);
    expect(callbackUrl.pathname).toBe('/auth/github/redirect');
    expect(callbackUrl.searchParams.get('mode')).toBe('success');
    expect(callbackUrl.searchParams.get('redirect')).toBe('/dashboard');
    expect(callbackUrl.searchParams.get('origin')).toBe(
      'http://localhost:4173',
    );

    const errorCallbackUrl = new URL(callArgs.body.errorCallbackURL);
    expect(errorCallbackUrl.searchParams.get('mode')).toBe('error');

    const cookieHeader = response.headers['set-cookie'];
    const cookies: string[] = Array.isArray(cookieHeader)
      ? cookieHeader
      : cookieHeader
        ? [cookieHeader]
        : [];

    expect(
      cookies.some((cookie) => cookie.includes('better-auth.state=stub-state')),
    ).toBe(true);
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

  it('GET /auth/github 요청 시 허용되지 않은 origin 은 무시하고 기본 origin 을 사용해야 한다', async () => {
    const response = await createAgent()
      .get('/auth/github?redirect=%2Fdashboard')
      .set('Referer', 'https://malicious.example.com/login')
      .redirects(0);

    expect(response.status).toBe(302);
    expect(signInSocialMock).toHaveBeenCalledTimes(1);

    const callArgs = signInSocialMock.mock.calls[0]?.[0] as {
      body: { callbackURL: string };
    };
    expect(callArgs).toBeDefined();

    const callbackUrl = new URL(callArgs.body.callbackURL);
    expect(callbackUrl.searchParams.get('origin')).toBe(
      'http://localhost:4173',
    );
  });

  it('GET /auth/github/redirect 요청 시 최종 목적지로 이동해야 한다', async () => {
    const response = await createAgent()
      .get(
        '/auth/github/redirect?redirect=%2Fdashboard&origin=http%3A%2F%2Flocalhost%3A4173&mode=success',
      )
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('http://localhost:4173/dashboard');
  });

  it('GET /auth/github/redirect 요청 시 오류 코드가 매핑돼야 한다', async () => {
    const response = await createAgent()
      .get(
        '/auth/github/redirect?redirect=%2Flogin&origin=http%3A%2F%2Flocalhost%3A4173&mode=error&error=access_denied',
      )
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:4173/login?authError=AUTH_PROVIDER_DENIED',
    );
  });

  it('GET /auth/github/redirect 요청 시 잘못된 redirect 는 기본 경로로 이동해야 한다', async () => {
    const response = await createAgent()
      .get(
        '/auth/github/redirect?redirect=//evil.com&origin=http%3A%2F%2Flocalhost%3A4173&mode=error',
      )
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:4173/dashboard?authError=AUTH_PROVIDER_ERROR',
    );
  });
});
