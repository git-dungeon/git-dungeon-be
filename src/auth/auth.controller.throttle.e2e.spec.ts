/// <reference types="vitest" />
import 'reflect-metadata';
import request from 'supertest';
import { createTestingApp } from '../test-support/app';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DEFAULT_THROTTLE_LIMIT } from '../config/rate-limit.constant';

vi.mock('typia', async () => {
  const { typiaModuleMock } = await import('../test-support/mocks/typia');
  return typiaModuleMock;
});
vi.mock('../config/rate-limit.constant', () => ({
  DEFAULT_THROTTLE_TTL_MS: 60_000,
  DEFAULT_THROTTLE_LIMIT: 5,
}));
vi.mock('@nestia/core', async () => {
  const { createNestiaModuleMock } = await import(
    '../test-support/mocks/nestia'
  );
  return createNestiaModuleMock();
});

describe('AuthController RateLimit (E2E)', () => {
  it('/auth/github 요청이 제한되면 AUTH_RATE_LIMITED를 반환해야 한다', async () => {
    const authServiceMock = {
      startGithubOAuth: vi.fn(),
      finalizeGithubRedirect: vi.fn(),
    };

    authServiceMock.startGithubOAuth.mockResolvedValue({
      location: 'https://github.com/login/oauth/authorize',
      cookies: ['better-auth.state=stub; Path=/; HttpOnly'],
    });

    const app = await createTestingApp({
      overrideProviders: [{ provide: AuthService, useValue: authServiceMock }],
    });

    const controller = app.get(AuthController);
    (controller as unknown as { authService: AuthService }).authService =
      authServiceMock as unknown as AuthService;

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      for (let i = 0; i < DEFAULT_THROTTLE_LIMIT; i += 1) {
        const ok = await agent
          .get('/auth/github')
          .set('x-request-id', '00000000-0000-4000-8000-000000000001');
        expect(ok.status).toBe(302);
      }

      const rateLimited = await agent
        .get('/auth/github')
        .set('x-request-id', '00000000-0000-4000-8000-000000000001');
      expect(rateLimited.status).toBe(429);
      expect(rateLimited.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTH_RATE_LIMITED',
        },
      });
    } finally {
      await app.close();
    }
  });
});
