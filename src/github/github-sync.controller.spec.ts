/// <reference types="vitest" />
import 'reflect-metadata';
import request from 'supertest';
import { ApSyncTokenType } from '@prisma/client';
import { AuthSessionService } from '../auth/auth-session.service';
import { createActiveSession } from '../test-support/fixtures';
import { createTestingApp } from '../test-support/app';
import { GithubManualSyncService } from './github-sync.manual.service';
import { GithubSyncController } from './github-sync.controller';

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

describe('GithubSyncController (E2E)', () => {
  it('/api/github/sync는 200을 반환해야 한다', async () => {
    const manualSyncServiceMock = {
      syncNow: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    manualSyncServiceMock.syncNow.mockResolvedValue({
      apDelta: 1,
      contributions: 1,
      windowStart: '2025-12-15T00:00:00.000Z',
      windowEnd: '2025-12-15T06:00:00.000Z',
      tokenType: ApSyncTokenType.OAUTH,
      rateLimitRemaining: 50,
      logId: '00000000-0000-4000-8000-000000000099',
      meta: null,
    });
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );

    const app = await createTestingApp({
      overrideProviders: [
        { provide: GithubManualSyncService, useValue: manualSyncServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
    });

    const controller = app.get(GithubSyncController);
    (
      controller as unknown as { manualSyncService: GithubManualSyncService }
    ).manualSyncService =
      manualSyncServiceMock as unknown as GithubManualSyncService;

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.post('/api/github/sync');

      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
