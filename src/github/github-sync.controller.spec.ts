/// <reference types="vitest" />
import 'reflect-metadata';
import request from 'supertest';
import { ApSyncTokenType } from '@prisma/client';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthSessionService } from '../auth/auth-session.service';
import { createActiveSession } from '../test-support/fixtures';
import { createTestingApp } from '../test-support/app';
import { GithubManualSyncService } from './github-sync.manual.service';

describe('GithubSyncController (E2E)', () => {
  type Meta = { requestId?: string };
  type ApiSuccess<T> = { success: true; data: T; meta: Meta };
  type ApiError = { success: false; error: { code: string }; meta: Meta };

  it('/api/github/sync/status는 200을 반환해야 한다', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const manualSyncServiceMock = {
      syncNow: vi.fn(),
      getSyncStatus: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    manualSyncServiceMock.getSyncStatus.mockResolvedValue({
      connected: true,
      allowed: false,
      cooldownMs: 6 * 60 * 60 * 1000,
      lastSyncAt: '2025-12-15T00:00:00.000Z',
      nextAvailableAt: '2025-12-15T06:00:00.000Z',
      retryAfterMs: 1234,
      lastManualSyncAt: '2025-12-15T00:00:00.000Z',
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

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent
        .get('/api/github/sync/status')
        .set('x-request-id', requestId);

      const body = response.body as unknown as ApiSuccess<unknown>;
      expect(response.status).toBe(200);
      expect(body.meta?.requestId).toBe(requestId);
    } finally {
      await app.close();
    }
  });

  it('/api/github/sync는 200을 반환해야 한다', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const manualSyncServiceMock = {
      syncNow: vi.fn(),
      getSyncStatus: vi.fn(),
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

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent
        .post('/api/github/sync')
        .set('x-request-id', requestId);

      const body = response.body as unknown as ApiSuccess<unknown>;
      expect(response.status).toBe(200);
      expect(body.meta?.requestId).toBe(requestId);
    } finally {
      await app.close();
    }
  });

  it('/api/github/sync는 동기화가 진행 중이면 409를 반환해야 한다', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const manualSyncServiceMock = {
      syncNow: vi.fn(),
      getSyncStatus: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    manualSyncServiceMock.syncNow.mockRejectedValue(
      new HttpException(
        {
          error: {
            code: 'GITHUB_SYNC_IN_PROGRESS',
            message:
              '동일 사용자의 GitHub 동기화가 이미 실행 중입니다. 잠시 후 다시 시도해주세요.',
          },
        },
        HttpStatus.CONFLICT,
      ),
    );
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

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent
        .post('/api/github/sync')
        .set('x-request-id', requestId);

      const body = response.body as unknown as ApiError;
      expect(response.status).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('GITHUB_SYNC_IN_PROGRESS');
      expect(body.meta?.requestId).toBe(requestId);
    } finally {
      await app.close();
    }
  });
});
