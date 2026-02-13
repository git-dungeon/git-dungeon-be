/// <reference types="vitest" />
import 'reflect-metadata';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import request from 'supertest';
import { createTestingApp } from '../test-support/app';
import { createActiveSession, TEST_USER_ID_1 } from '../test-support/fixtures';
import { AuthSessionService } from '../auth/auth-session.service';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';

describe('CollectionController (E2E)', () => {
  const setupApp = async (options?: { guards?: CanActivate[] }) => {
    const collectionServiceMock = {
      getCollection: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: CollectionService, useValue: collectionServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
      globalGuards: options?.guards,
    });

    const controller = app.get(CollectionController);
    (
      controller as unknown as { collectionService: CollectionService }
    ).collectionService = collectionServiceMock as unknown as CollectionService;

    return { app, collectionServiceMock, authSessionServiceMock };
  };

  it('GET /api/collection 응답에 summary/discoveredCodes를 포함해야 한다', async () => {
    const { app, collectionServiceMock, authSessionServiceMock } =
      await setupApp();
    const payload = {
      summary: {
        items: { discovered: 2, total: 3, percent: 67 },
        monsters: { discovered: 1, total: 2, percent: 50 },
        overall: { discovered: 3, total: 5, percent: 60 },
      },
      items: {
        discoveredCodes: ['item-a', 'material-b'],
      },
      monsters: {
        discoveredCodes: ['monster-b'],
      },
    };

    collectionServiceMock.getCollection.mockResolvedValue(payload);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/collection');
      const body = response.body as {
        success: boolean;
        data: typeof payload;
        meta: { requestId?: string; generatedAt?: string };
      };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(payload);
      expect(body.meta.requestId).toEqual(expect.any(String));
      expect(body.meta.generatedAt).toEqual(expect.any(String));
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']?.[0]).toContain(
        'better-auth.session_token=fresh',
      );

      expect(collectionServiceMock.getCollection).toHaveBeenCalledWith(
        TEST_USER_ID_1,
      );
    } finally {
      await app.close();
    }
  });

  it('레이트리밋 시 COLLECTION_RATE_LIMITED를 반환해야 한다', async () => {
    class AlwaysThrottleGuard implements CanActivate {
      canActivate(_context: ExecutionContext): boolean {
        throw new HttpException(
          { error: { code: 'COLLECTION_RATE_LIMITED' } },
          429,
        );
      }
    }

    const { app, authSessionServiceMock } = await setupApp({
      guards: [new AlwaysThrottleGuard()],
    });
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/collection');
      const body = response.body as {
        success: boolean;
        error?: { code?: string };
      };

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('COLLECTION_RATE_LIMITED');
    } finally {
      await app.close();
    }
  });
});
