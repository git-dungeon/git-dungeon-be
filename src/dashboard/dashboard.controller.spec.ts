/// <reference types="vitest" />
import 'reflect-metadata';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthSessionService } from '../auth/auth-session.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  createActiveSession,
  createDashboardStateResponse,
} from '../test-support/fixtures';
import { createTestingApp } from '../test-support/app';

describe('DashboardController (E2E)', () => {
  const setupApp = async (options?: { guards?: CanActivate[] }) => {
    const dashboardServiceMock = {
      getState: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: DashboardService, useValue: dashboardServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
      globalGuards: options?.guards,
    });

    const controller = app.get(DashboardController);
    (
      controller as unknown as { dashboardService: DashboardService }
    ).dashboardService = dashboardServiceMock as unknown as DashboardService;

    return { app, dashboardServiceMock, authSessionServiceMock };
  };

  it('/api/state 성공 응답을 반환해야 한다', async () => {
    const { app, dashboardServiceMock, authSessionServiceMock } =
      await setupApp();
    const dashboardState = createDashboardStateResponse();
    dashboardServiceMock.getState.mockResolvedValue(dashboardState);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/state');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
      expect(response.headers['set-cookie']).toEqual([
        'better-auth.session_token=fresh; Path=/; HttpOnly',
      ]);

      const body = response.body as {
        success: boolean;
        data: typeof dashboardState;
        meta: { generatedAt?: string; requestId?: string };
      };

      expect(body.success).toBe(true);
      expect(body.data).toEqual(dashboardState);
      expect(body.meta.generatedAt).toEqual(expect.any(String));
      expect(new Date(body.meta.generatedAt ?? '').toISOString()).toBe(
        body.meta.generatedAt,
      );
      expect(body.meta.requestId).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });

  it('/api/state에서 DASHBOARD_UNAUTHORIZED 오류를 반환해야 한다', async () => {
    const { app, dashboardServiceMock, authSessionServiceMock } =
      await setupApp();
    dashboardServiceMock.getState.mockRejectedValue(
      new UnauthorizedException({
        code: 'DASHBOARD_UNAUTHORIZED',
      }),
    );
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/state');

      expect(response.status).toBe(401);
      const body = response.body as {
        success: false;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DASHBOARD_UNAUTHORIZED');
    } finally {
      await app.close();
    }
  });

  it('요청이 제한되면 DASHBOARD_RATE_LIMITED를 반환해야 한다', async () => {
    class AlwaysThrottleGuard implements CanActivate {
      canActivate(_context: ExecutionContext): boolean {
        throw new HttpException(
          { error: { code: 'DASHBOARD_RATE_LIMITED' } },
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
      const response = await agent.get('/api/state');

      expect(response.status).toBe(429);
      const body = response.body as {
        success: false;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DASHBOARD_RATE_LIMITED');
    } finally {
      await app.close();
    }
  });
});
