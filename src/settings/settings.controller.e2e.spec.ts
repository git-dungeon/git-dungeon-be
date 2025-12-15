/// <reference types="vitest" />
import 'reflect-metadata';
import request from 'supertest';
import { AuthSessionService } from '../auth/auth-session.service';
import { createActiveSession, TEST_USER_ID_1 } from '../test-support/fixtures';
import { createTestingApp } from '../test-support/app';
import { SettingsService } from './settings.service';

vi.mock('typia', async () => {
  const { typiaModuleMock } = await import('../test-support/mocks/typia');
  return typiaModuleMock;
});
vi.mock('@nestia/core', async () => {
  const { createNestiaModuleMock } = await import(
    '../test-support/mocks/nestia'
  );
  return createNestiaModuleMock();
});

describe('SettingsController (E2E)', () => {
  it('/api/settings/profile 요청이 제한되면 SETTINGS_RATE_LIMITED를 반환해야 한다', async () => {
    const settingsServiceMock = {
      getProfile: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    settingsServiceMock.getProfile.mockResolvedValue({
      profile: {
        userId: TEST_USER_ID_1,
        username: 'mock-user',
        displayName: 'Mock User',
        avatarUrl: 'https://example.com/avatar.png',
        email: 'mock@example.com',
        joinedAt: '2023-11-02T12:00:00.000Z',
      },
      connections: {
        github: {
          connected: true,
          lastSyncAt: '2025-10-17T01:15:00.000Z',
        },
      },
    });
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );

    const app = await createTestingApp({
      overrideProviders: [
        { provide: SettingsService, useValue: settingsServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      for (let i = 0; i < 60; i += 1) {
        const ok = await agent
          .get('/api/settings/profile')
          .set('x-request-id', '00000000-0000-4000-8000-000000000001');
        expect(ok.status).toBe(200);
      }

      const rateLimited = await agent
        .get('/api/settings/profile')
        .set('x-request-id', '00000000-0000-4000-8000-000000000001');
      expect(rateLimited.status).toBe(429);
      expect(rateLimited.body).toMatchObject({
        success: false,
        error: {
          code: 'SETTINGS_RATE_LIMITED',
        },
      });
    } finally {
      await app.close();
    }
  });
});
