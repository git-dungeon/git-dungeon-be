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
    'http://localhost:4173/auth/github/callback';
  process.env.AUTH_GITHUB_SCOPE = 'read:user,user:email';
  process.env.DATABASE_SKIP_CONNECTION = 'true';
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

  const createAgent = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  beforeAll(async () => {
    setupTestEnv();

    const stubHeaders = new Headers();
    const setCookieValue =
      'better-auth.state=stub-state; Path=/; HttpOnly; SameSite=Lax';
    stubHeaders.append('set-cookie', setCookieValue);
    Object.defineProperty(stubHeaders, 'getSetCookie', {
      configurable: true,
      value: () => [setCookieValue],
    });

    const stubAuth = {
      api: {
        signInSocial: vi.fn().mockResolvedValue({
          headers: stubHeaders,
          response: {
            url: 'https://github.com/login/oauth/authorize?client_id=test-client-id',
          },
        }),
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
  });
});
