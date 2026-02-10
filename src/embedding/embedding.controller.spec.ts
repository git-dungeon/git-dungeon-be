/// <reference types="vitest" />
import type { Request, Response } from 'express';
import type { EmbeddingPreviewPayload } from './dto/embedding-preview-response.dto';
import { EmbeddingController } from './embedding.controller';
import type { EmbeddingService } from './embedding.service';

describe('EmbeddingController', () => {
  const REQUEST_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  const serviceMock = {
    getPreview: vi.fn(),
    getPreviewSvg: vi.fn(),
  };

  const createResponse = () => {
    const headers = new Map<string, string | string[]>();

    return {
      headers,
      setHeader: vi.fn((key: string, value: string) => {
        headers.set(key.toLowerCase(), value);
      }),
    };
  };

  const createRequest = (overrides: Partial<{ id: string }> = {}) => ({
    id: overrides.id ?? REQUEST_ID,
  });

  beforeEach(() => {
    serviceMock.getPreview.mockReset();
    serviceMock.getPreviewSvg.mockReset();
  });

  it('cache 헤더와 ApiResponse 구조를 반환해야 한다', async () => {
    const controller = new EmbeddingController(
      serviceMock as unknown as EmbeddingService,
    );

    const payload: EmbeddingPreviewPayload = {
      theme: 'dark',
      size: 'wide',
      language: 'ko',
      generatedAt: '2026-01-10T00:00:00.000Z',
      overview: {
        displayName: 'Mock User',
        avatarUrl: 'https://example.com/avatar.png',
        level: 8,
        exp: 54,
        expToLevel: 80,
        gold: 640,
        ap: 18,
        maxAp: null,
        floor: { current: 13, best: 15, progress: 60 },
        stats: {
          total: { hp: 32, maxHp: 40, atk: 18, def: 14, luck: 6, ap: 18 },
          base: { hp: 28, maxHp: 36, atk: 16, def: 13, luck: 6, ap: 18 },
          equipmentBonus: { hp: 4, maxHp: 4, atk: 2, def: 1, luck: 0, ap: 0 },
        },
        equipment: [],
      },
    };

    serviceMock.getPreview.mockResolvedValue(payload);

    const response = createResponse();
    const request = createRequest() as Request & { id?: string };

    const result = await controller.getPreview(
      request,
      response as unknown as Response,
      { userId: '00000000-0000-4000-8000-000000000001' },
    );

    expect(serviceMock.getPreview).toHaveBeenCalledWith({
      userId: '00000000-0000-4000-8000-000000000001',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(payload);
    expect(result.meta.requestId).toBe(REQUEST_ID);
    expect(result.meta.generatedAt).toEqual(expect.any(String));
  });

  it('SVG 프리뷰를 반환해야 한다', async () => {
    const controller = new EmbeddingController(
      serviceMock as unknown as EmbeddingService,
    );

    const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    serviceMock.getPreviewSvg.mockResolvedValue(svgMarkup);

    const response = createResponse();
    const request = createRequest() as Request & { id?: string };

    const result = await controller.getPreviewSvg(
      request,
      response as unknown as Response,
      { userId: '00000000-0000-4000-8000-000000000001' },
    );

    expect(serviceMock.getPreviewSvg).toHaveBeenCalledWith({
      userId: '00000000-0000-4000-8000-000000000001',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/svg+xml; charset=utf-8',
    );
    expect(result).toBe(svgMarkup);
  });
});
