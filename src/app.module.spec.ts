import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { Logger } from 'nestjs-pino';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('AppModule 테스트', () => {
  it('헬스 체크 응답을 반환해야 한다', async () => {
    const { AppModule } = await import('./app.module');
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(testingModule).toBeDefined();

    const app = testingModule.createNestApplication<NestExpressApplication>();
    app.useLogger(app.get(Logger));
    await app.init();

    const server = app.getHttpServer();
    const response = await request(server).get('/health');

    const body = response.body as unknown;

    const payload = body as {
      success: boolean;
      data?: { status: string; version: string; timestamp: string };
      meta?: { requestId: string; generatedAt: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);

    const data = payload.data;
    expect(data).toBeDefined();
    expect(data?.status).toBe('ok');
    expect(typeof data?.version).toBe('string');
    expect(typeof data?.timestamp).toBe('string');

    const meta = payload.meta;
    expect(meta).toBeDefined();
    expect(typeof meta?.requestId).toBe('string');
    expect(meta?.requestId).toMatch(UUID_REGEX);
    expect(typeof meta?.generatedAt).toBe('string');
    expect('x-request-id' in response.headers).toBe(true);
    expect(response.headers['x-request-id']).toMatch(UUID_REGEX);

    await app.close();
    await testingModule.close();
  }, 15000);
});
