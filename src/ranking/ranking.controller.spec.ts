/// <reference types="vitest" />
import 'reflect-metadata';
import type { CanActivate } from '@nestjs/common';
import request from 'supertest';
import { createTestingApp } from '../test-support/app';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { encodeRankingCursor } from './ranking-cursor.util';

describe('RankingController (E2E)', () => {
  const setupApp = async (options?: { guards?: CanActivate[] }) => {
    const rankingServiceMock = {
      getRanking: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: RankingService, useValue: rankingServiceMock },
      ],
      globalGuards: options?.guards,
    });

    const controller = app.get(RankingController);
    (
      controller as unknown as { rankingService: RankingService }
    ).rankingService = rankingServiceMock as unknown as RankingService;

    return { app, rankingServiceMock };
  };

  it('기본 파라미터로 랭킹을 조회하고 메타/헤더를 반환해야 한다', async () => {
    const { app, rankingServiceMock } = await setupApp();
    const payload = {
      rankings: [
        {
          rank: 1,
          displayName: 'Hero',
          avatarUrl: null,
          level: 10,
          maxFloor: 20,
        },
      ],
      nextCursor: null,
    };
    rankingServiceMock.getRanking.mockResolvedValue(payload);

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent.get('/api/ranking');
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

      expect(rankingServiceMock.getRanking).toHaveBeenCalledWith({
        limit: 10,
        offset: undefined,
      });
    } finally {
      await app.close();
    }
  });

  it('cursor/limit 쿼리를 적용해 랭킹을 조회해야 한다', async () => {
    const { app, rankingServiceMock } = await setupApp();
    const payload = { rankings: [], nextCursor: null };
    rankingServiceMock.getRanking.mockResolvedValue(payload);

    const cursor = encodeRankingCursor({ offset: 10 });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      await agent.get('/api/ranking').query({ limit: 5, cursor });

      expect(rankingServiceMock.getRanking).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
      });
    } finally {
      await app.close();
    }
  });
});
