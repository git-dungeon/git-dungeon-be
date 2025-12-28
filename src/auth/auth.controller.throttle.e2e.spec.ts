/// <reference types="vitest" />
/**
 * Rate Limit E2E 테스트
 *
 * - 테스트 전용 한도 5로 고정 (vi.mock)
 * - 병렬 실행에서도 안정적으로 재현 가능
 *
 * 한도 변경 시: vi.mock의 DEFAULT_THROTTLE_LIMIT 값 수정
 */
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

// 테스트 한도를 5로 고정 (플래키 방지)
// 주의: vi.mock은 호이스팅되므로 리터럴 값만 사용 가능
vi.mock('../config/rate-limit.constant', () => ({
  DEFAULT_THROTTLE_TTL_MS: 60_000,
  DEFAULT_THROTTLE_LIMIT: 5, // 테스트 전용 고정값
}));

vi.mock('@nestia/core', async () => {
  const { createNestiaModuleMock } = await import(
    '../test-support/mocks/nestia'
  );
  return createNestiaModuleMock();
});

describe('AuthController RateLimit (E2E)', () => {
  it(`/auth/github 요청이 ${DEFAULT_THROTTLE_LIMIT}회 초과 시 AUTH_RATE_LIMITED를 반환`, async () => {
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
      // 한도 내 요청: 모두 성공 (302)
      for (let i = 0; i < DEFAULT_THROTTLE_LIMIT; i += 1) {
        const ok = await agent
          .get('/auth/github')
          .set('x-request-id', '00000000-0000-4000-8000-000000000001');
        expect(ok.status).toBe(302);
      }

      // 한도 초과 요청: 429 반환
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
