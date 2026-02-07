/// <reference types="vitest" />
import 'reflect-metadata';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthSessionService } from '../auth/auth-session.service';
import { InventoryService } from './inventory.service';
import {
  createActiveSession,
  createInventoryResponse,
} from '../test-support/fixtures';
import { createTestingApp } from '../test-support/app';
import { InventoryController } from './inventory.controller';

describe('InventoryController (E2E)', () => {
  const setupApp = async (options?: { guards?: CanActivate[] }) => {
    const inventoryServiceMock = {
      getInventory: vi.fn(),
      equipItem: vi.fn(),
      unequipItem: vi.fn(),
      discardItem: vi.fn(),
      dismantleItem: vi.fn(),
    };
    const authSessionServiceMock = {
      requireActiveSession: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: InventoryService, useValue: inventoryServiceMock },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
      globalGuards: options?.guards,
    });

    const controller = app.get(InventoryController);
    (
      controller as unknown as { inventoryService: InventoryService }
    ).inventoryService = inventoryServiceMock as unknown as InventoryService;

    return { app, inventoryServiceMock, authSessionServiceMock };
  };

  it('/api/inventory 성공 응답을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    const inventoryResponse = createInventoryResponse();
    inventoryServiceMock.getInventory.mockResolvedValue(inventoryResponse);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/inventory');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
      expect(response.headers['set-cookie']).toEqual([
        'better-auth.session_token=fresh; Path=/; HttpOnly',
      ]);

      const body = response.body as {
        success: boolean;
        data: typeof inventoryResponse;
        meta: { generatedAt?: string; requestId?: string };
      };

      expect(body.success).toBe(true);
      expect(body.data).toEqual(inventoryResponse);
      expect(body.meta.generatedAt).toEqual(expect.any(String));
      expect(new Date(body.meta.generatedAt ?? '').toISOString()).toBe(
        body.meta.generatedAt,
      );
      expect(body.meta.requestId).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });

  it('/api/inventory에서 INVENTORY_UNAUTHORIZED 오류를 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    inventoryServiceMock.getInventory.mockRejectedValue(
      new UnauthorizedException({ code: 'INVENTORY_UNAUTHORIZED' }),
    );
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession(),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/inventory');

      expect(response.status).toBe(401);
      const body = response.body as {
        success: false;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVENTORY_UNAUTHORIZED');
    } finally {
      await app.close();
    }
  });

  it('요청이 제한되면 INVENTORY_RATE_LIMITED를 반환해야 한다', async () => {
    class AlwaysThrottleGuard implements CanActivate {
      canActivate(_context: ExecutionContext): boolean {
        throw new HttpException(
          { error: { code: 'INVENTORY_RATE_LIMITED' } },
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
      const response = await agent.get('/api/inventory');

      expect(response.status).toBe(429);
      const body = response.body as {
        success: false;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVENTORY_RATE_LIMITED');
    } finally {
      await app.close();
    }
  });

  it('/api/inventory/equip는 200을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    const inventoryResponse = createInventoryResponse();
    inventoryServiceMock.equipItem.mockResolvedValue(inventoryResponse);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.post('/api/inventory/equip').send({
        itemId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('/api/inventory/equip 요청의 itemId가 uuid가 아니면 400을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    inventoryServiceMock.equipItem.mockResolvedValue(createInventoryResponse());
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.post('/api/inventory/equip').send({
        itemId: 'weapon-longsword',
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(response.status).toBe(400);
      expect(inventoryServiceMock.equipItem).not.toHaveBeenCalled();
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('/api/inventory/unequip는 200을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    const inventoryResponse = createInventoryResponse();
    inventoryServiceMock.unequipItem.mockResolvedValue(inventoryResponse);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.post('/api/inventory/unequip').send({
        itemId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('/api/inventory/discard는 200을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    const inventoryResponse = createInventoryResponse();
    inventoryServiceMock.discardItem.mockResolvedValue(inventoryResponse);
    const session = createActiveSession({
      cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
    });
    authSessionServiceMock.requireActiveSession.mockResolvedValue(session);
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const payload = {
        itemId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 1,
        inventoryVersion: 1,
        quantity: 2,
      };
      const response = await agent.post('/api/inventory/discard').send(payload);

      expect(response.status).toBe(200);
      expect(inventoryServiceMock.discardItem).toHaveBeenCalledWith(
        session.view.session.userId,
        payload,
      );
    } finally {
      await app.close();
    }
  });

  it('/api/inventory/dismantle는 200을 반환해야 한다', async () => {
    const { app, inventoryServiceMock, authSessionServiceMock } =
      await setupApp();
    const inventoryResponse = createInventoryResponse();
    inventoryServiceMock.dismantleItem.mockResolvedValue(inventoryResponse);
    authSessionServiceMock.requireActiveSession.mockResolvedValue(
      createActiveSession({
        cookies: ['better-auth.session_token=fresh; Path=/; HttpOnly'],
      }),
    );
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.post('/api/inventory/dismantle').send({
        itemId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 1,
        inventoryVersion: 1,
      });

      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
