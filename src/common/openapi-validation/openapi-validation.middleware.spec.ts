import 'reflect-metadata';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { normalizeOpenApiDocumentForAjv } from './openapi-normalizer';
import { buildOpenApiOperationIndex } from './openapi-operation-index';
import { OpenApiRequestValidator } from './request-validator';
import { OpenApiValidationMiddleware } from './validation.middleware';

describe('OpenApiValidationMiddleware', () => {
  it('OpenAPI 스키마 위반 요청은 400을 반환해야 한다', async () => {
    const document = normalizeOpenApiDocumentForAjv({
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.0' },
      paths: {
        '/api/inventory/equip': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      itemId: { type: 'string', format: 'uuid' },
                      expectedVersion: { type: 'integer', minimum: 0 },
                      inventoryVersion: { type: 'integer', minimum: 0 },
                    },
                    required: ['itemId', 'expectedVersion', 'inventoryVersion'],
                  },
                },
              },
            },
          },
        },
      },
    });

    const index = buildOpenApiOperationIndex(
      document as unknown as Record<string, unknown>,
    );
    const validator = new OpenApiRequestValidator(index);
    const runtime = { validator };
    const middleware = new OpenApiValidationMiddleware(runtime);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request & { id: string }).id =
        '00000000-0000-4000-8000-000000000001';
      next();
    });
    app.use((req, res, next) =>
      middleware.use(req as Request & { id?: string }, res, next),
    );
    app.post('/api/inventory/equip', (_req, res) =>
      res.status(200).json({ ok: true }),
    );

    const response = await request(app).post('/api/inventory/equip').send({
      itemId: 'weapon-longsword',
      expectedVersion: 1,
      inventoryVersion: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
      meta: { requestId: '00000000-0000-4000-8000-000000000001' },
    });
  });

  it('OpenAPI에 없는 라우트는 검증 없이 통과시켜야 한다', async () => {
    const document = normalizeOpenApiDocumentForAjv({
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.0' },
      paths: {
        '/api/inventory/equip': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      itemId: { type: 'string', format: 'uuid' },
                    },
                    required: ['itemId'],
                  },
                },
              },
            },
          },
        },
      },
    });

    const index = buildOpenApiOperationIndex(
      document as unknown as Record<string, unknown>,
    );
    const validator = new OpenApiRequestValidator(index);
    const runtime = { validator };
    const middleware = new OpenApiValidationMiddleware(runtime);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request & { id: string }).id =
        '00000000-0000-4000-8000-000000000001';
      next();
    });
    app.use((req, res, next) =>
      middleware.use(req as Request & { id?: string }, res, next),
    );
    app.post('/api/not-in-spec', (_req, res) =>
      res.status(200).json({ ok: true }),
    );
    app.post('/api/inventory/equip', (_req, res) =>
      res.status(200).json({ ok: true }),
    );

    const response = await request(app).post('/api/not-in-spec').send({
      itemId: 'weapon-longsword',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });

  it('path parameter 라우트도 OpenAPI 템플릿으로 매칭되어야 한다', async () => {
    const document = normalizeOpenApiDocumentForAjv({
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.0' },
      paths: {
        '/api/logs/{logId}': {
          get: {
            parameters: [
              {
                in: 'query',
                name: 'limit',
                required: false,
                schema: { type: 'integer', minimum: 1, maximum: 50 },
              },
            ],
          },
        },
      },
    });

    const index = buildOpenApiOperationIndex(
      document as unknown as Record<string, unknown>,
    );
    const validator = new OpenApiRequestValidator(index);
    const runtime = { validator };
    const middleware = new OpenApiValidationMiddleware(runtime);

    const app = express();
    app.use((req, _res, next) => {
      (req as Request & { id: string }).id =
        '00000000-0000-4000-8000-000000000001';
      next();
    });
    app.use((req, res, next) =>
      middleware.use(req as Request & { id?: string }, res, next),
    );
    app.get('/api/logs/:logId', (_req, res) =>
      res.status(200).json({ ok: true }),
    );

    const response = await request(app).get('/api/logs/abc123').query({
      limit: 0,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
