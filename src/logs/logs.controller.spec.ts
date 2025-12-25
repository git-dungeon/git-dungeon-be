/// <reference types="vitest" />
import 'reflect-metadata';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
} from '@prisma/client';
import request from 'supertest';
import { createTestingApp } from '../test-support/app';
import { createActiveSession } from '../test-support/fixtures';
import { AuthSessionService } from '../auth/auth-session.service';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { encodeLogsCursor } from './logs-cursor.util';

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

describe('LogsController (E2E)', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
  const LOG_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LOG_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const setupApp = async (options?: { guards?: CanActivate[] }) => {
    const logsServiceMock = {
      getLogs: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: LogsService, useValue: logsServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
      globalGuards: options?.guards,
    });

    const controller = app.get(LogsController);
    (controller as unknown as { logsService: LogsService }).logsService =
      logsServiceMock as unknown as LogsService;

    return { app, logsServiceMock, authSessionServiceMock };
  };

  const createSamplePayload = () => ({
    logs: [
      {
        id: LOG_ID_1,
        category: DungeonLogCategory.EXPLORATION,
        action: DungeonLogAction.BATTLE,
        status: DungeonLogStatus.STARTED,
        floor: 3,
        turnNumber: 10,
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        delta: null,
        extra: null,
        createdAt: '2025-10-17T01:59:00.000Z',
      },
    ],
    nextCursor: null,
  });

  it('기본 파라미터로 로그를 조회하고 메타/헤더를 반환해야 한다', async () => {
    const { app, logsServiceMock, authSessionServiceMock } = await setupApp();
    const payload = createSamplePayload();
    logsServiceMock.getLogs.mockResolvedValue(payload);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/logs');
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
      expect(response.headers.pragma).toBe('no-cache');

      expect(logsServiceMock.getLogs).toHaveBeenCalledWith({
        userId: USER_ID_1,
        limit: 10,
        cursor: undefined,
        cursorPayload: undefined,
        type: undefined,
      });
    } finally {
      await app.close();
    }
  });

  it('인벤토리 로그(EQUIP_ITEM)를 포함해 응답해야 한다', async () => {
    const { app, logsServiceMock, authSessionServiceMock } = await setupApp();
    const payload = {
      logs: [
        {
          id: LOG_ID_2,
          category: DungeonLogCategory.STATUS,
          action: DungeonLogAction.EQUIP_ITEM,
          status: DungeonLogStatus.COMPLETED,
          floor: null,
          turnNumber: null,
          stateVersionBefore: null,
          stateVersionAfter: null,
          delta: {
            type: 'EQUIP_ITEM',
            detail: {
              inventory: {
                equipped: {
                  slot: 'weapon',
                  itemId: 'inventory-item-id',
                  code: 'weapon-longsword',
                },
              },
            },
          },
          extra: {
            type: 'EQUIP_ITEM',
            details: {
              item: {
                id: 'inventory-item-id',
                code: 'weapon-longsword',
                slot: 'weapon',
                rarity: 'rare',
                name: null,
                modifiers: [
                  { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
                ],
              },
            },
          },
          createdAt: '2025-10-17T01:59:00.000Z',
        },
      ],
      nextCursor: null,
    };
    logsServiceMock.getLogs.mockResolvedValue(payload);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/logs');
      const body = response.body as {
        data?: { logs?: Array<{ action?: string; category?: string }> };
      };
      expect(response.status).toBe(200);
      expect(body.data?.logs?.[0]?.action).toBe('EQUIP_ITEM');
      expect(body.data?.logs?.[0]?.category).toBe('STATUS');
    } finally {
      await app.close();
    }
  });

  it('cursor/type/limit 쿼리를 적용해 로그를 조회해야 한다', async () => {
    const { app, logsServiceMock, authSessionServiceMock } = await setupApp();
    const payload = createSamplePayload();
    logsServiceMock.getLogs.mockResolvedValue(payload);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const cursorPayload = { sequence: 10n };
    const cursor = encodeLogsCursor(cursorPayload);

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent
        .get('/api/logs')
        .query({ limit: 5, cursor, type: DungeonLogCategory.STATUS });

      expect(response.status).toBe(200);
      expect(logsServiceMock.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID_1,
          limit: 5,
          cursor,
          cursorPayload,
          type: DungeonLogCategory.STATUS,
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('nextCursor를 사용해 다음 페이지를 이어서 조회해야 한다', async () => {
    const { app, logsServiceMock, authSessionServiceMock } = await setupApp();
    const firstCursorPayload = { sequence: 10n };
    const nextCursor = encodeLogsCursor(firstCursorPayload);

    const firstPage = {
      ...createSamplePayload(),
      nextCursor,
    };
    const secondPage = {
      logs: [
        {
          id: LOG_ID_2,
          category: DungeonLogCategory.STATUS,
          action: DungeonLogAction.REST,
          status: DungeonLogStatus.COMPLETED,
          floor: 4,
          turnNumber: 18,
          stateVersionBefore: 2,
          stateVersionAfter: 3,
          delta: null,
          extra: null,
          createdAt: '2025-10-17T02:01:00.000Z',
        },
      ],
      nextCursor: null,
    };

    logsServiceMock.getLogs
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const firstResponse = await agent.get('/api/logs');
      expect(firstResponse.status).toBe(200);

      const firstBodyUnknown = firstResponse.body as unknown;
      const isValidPage = (
        value: unknown,
      ): value is { data: typeof firstPage } => {
        if (!value || typeof value !== 'object') return false;
        const data = (value as { data?: unknown }).data;
        return !!(data && typeof data === 'object' && 'logs' in data);
      };
      expect(isValidPage(firstBodyUnknown)).toBe(true);
      if (!isValidPage(firstBodyUnknown)) {
        throw new Error('Invalid logs response');
      }
      const firstBody = firstBodyUnknown;
      expect(firstBody.data.nextCursor).toBe(nextCursor);

      const secondResponse = await agent
        .get('/api/logs')
        .query({ cursor: firstBody.data.nextCursor });
      expect(secondResponse.status).toBe(200);

      expect(logsServiceMock.getLogs).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          cursor: undefined,
          cursorPayload: undefined,
        }),
      );

      const [, secondCall] = logsServiceMock.getLogs.mock.calls;
      expect(secondCall?.[0]).toMatchObject({
        cursor: nextCursor,
      });
      const secondArg = secondCall?.[0] as
        | { cursorPayload?: unknown }
        | undefined;
      const cursorPayload = secondArg?.cursorPayload;
      expect(cursorPayload && typeof cursorPayload === 'object').toBe(true);
      if (cursorPayload && typeof cursorPayload === 'object') {
        expect(cursorPayload).toMatchObject({
          sequence: firstCursorPayload.sequence,
        });
        expect(typeof (cursorPayload as { sequence?: unknown }).sequence).toBe(
          'bigint',
        );
      }
    } finally {
      await app.close();
    }
  });

  it('잘못된 limit이면 LOGS_INVALID_QUERY로 400을 반환해야 한다', async () => {
    const { app, logsServiceMock, authSessionServiceMock } = await setupApp();
    const payload = createSamplePayload();
    logsServiceMock.getLogs.mockResolvedValue(payload);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/logs').query({ limit: 0 });
      const body = response.body as {
        success: boolean;
        error?: { code?: string };
      };

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('LOGS_INVALID_QUERY');
      expect(logsServiceMock.getLogs).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('레이트리밋 시 LOGS_RATE_LIMITED를 반환해야 한다', async () => {
    class AlwaysThrottleGuard implements CanActivate {
      canActivate(_context: ExecutionContext): boolean {
        throw new HttpException({ error: { code: 'LOGS_RATE_LIMITED' } }, 429);
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
      const response = await agent.get('/api/logs');
      const body = response.body as {
        success: boolean;
        error?: { code?: string };
      };

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('LOGS_RATE_LIMITED');
    } finally {
      await app.close();
    }
  });
});
