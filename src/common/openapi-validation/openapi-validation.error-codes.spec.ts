import 'reflect-metadata';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { normalizeOpenApiDocumentForAjv } from './openapi-normalizer';
import { buildOpenApiOperationIndex } from './openapi-operation-index';
import { OpenApiRequestValidator } from './request-validator';
import { OpenApiValidationMiddleware } from './validation.middleware';

describe('OpenAPI(Ajv) validation error code mapping', () => {
  const document = normalizeOpenApiDocumentForAjv({
    openapi: '3.1.0',
    info: { title: 'test', version: '0.0.0' },
    paths: {
      '/api/logs': {
        get: {
          parameters: [
            {
              in: 'query',
              name: 'limit',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            },
          ],
        },
      },
      '/api/ranking': {
        get: {
          parameters: [
            {
              in: 'query',
              name: 'limit',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
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
  const runtime = { mode: 'enforce' as const, validator };
  const middleware = new OpenApiValidationMiddleware(runtime);

  const buildApp = () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as Request & { id: string }).id =
        '00000000-0000-4000-8000-000000000001';
      next();
    });
    app.use((req, res, next) =>
      middleware.use(req as Request & { id?: string }, res, next),
    );
    app.get('/api/logs', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/ranking', (_req, res) => res.status(200).json({ ok: true }));
    return app;
  };

  it('GET /api/logs invalid query는 LOGS_INVALID_QUERY로 400을 반환해야 한다', async () => {
    const response = await request(buildApp())
      .get('/api/logs')
      .query({ limit: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'LOGS_INVALID_QUERY',
        message: '잘못된 로그 조회 요청입니다.',
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000001' },
    });
  });

  it('GET /api/ranking invalid query는 RANKING_INVALID_QUERY로 400을 반환해야 한다', async () => {
    const response = await request(buildApp())
      .get('/api/ranking')
      .query({ limit: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'RANKING_INVALID_QUERY',
        message: '잘못된 랭킹 조회 요청입니다.',
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000001' },
    });
  });
});
