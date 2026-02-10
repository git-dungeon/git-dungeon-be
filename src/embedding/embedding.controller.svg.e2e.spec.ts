/// <reference types="vitest" />
import 'reflect-metadata';
import request from 'supertest';
import { createTestingApp } from '../test-support/app';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';

describe('EmbeddingController SVG (E2E)', () => {
  const setupApp = async () => {
    const embeddingServiceMock: Pick<
      EmbeddingService,
      'getPreviewSvg' | 'getPreview'
    > = {
      getPreviewSvg: vi.fn(),
      getPreview: vi.fn(),
    };

    const app = await createTestingApp({
      overrideProviders: [
        { provide: EmbeddingService, useValue: embeddingServiceMock },
        {
          provide: AuthenticatedThrottlerGuard,
          useValue: { canActivate: () => true },
        },
      ],
    });

    app.get(EmbeddingController);

    return {
      app,
      embeddingServiceMock,
    };
  };

  it('SVG 응답과 Content-Type을 반환해야 한다', async () => {
    const { app, embeddingServiceMock } = await setupApp();
    const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const getPreviewSvgMock = vi.isMockFunction(
      embeddingServiceMock.getPreviewSvg,
    )
      ? embeddingServiceMock.getPreviewSvg
      : vi.spyOn(embeddingServiceMock, 'getPreviewSvg');

    getPreviewSvgMock.mockResolvedValue(svgMarkup);

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request(server);

    try {
      const response = await agent
        .get('/api/embedding/preview.svg')
        .query({ userId: '00000000-0000-4000-8000-000000000001' });

      const bodyText =
        response.text ??
        (response.body ? (response.body as Buffer).toString() : '');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/svg+xml');
      expect(bodyText.trim().startsWith('<svg')).toBe(true);
      expect(bodyText).toBe(svgMarkup);
      expect(embeddingServiceMock.getPreviewSvg).toHaveBeenCalledWith({
        userId: '00000000-0000-4000-8000-000000000001',
      });
    } finally {
      await app.close();
    }
  }, 10000);
});
