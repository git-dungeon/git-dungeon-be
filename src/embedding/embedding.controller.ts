import { Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { TypedQuery, TypedRoute } from '@nestia/core';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import type { EmbeddingPreviewQueryDto } from './dto/embedding-preview.request';
import type { EmbeddingPreviewPayload } from './dto/embedding-preview.response';
import { EmbeddingService } from './embedding.service';

@ApiTags('Embedding')
@Controller('api/embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @TypedRoute.Get<ApiSuccessResponse<EmbeddingPreviewPayload>>('preview')
  @UseGuards(AuthenticatedThrottlerGuard)
  async getPreview(
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
    @TypedQuery() query: EmbeddingPreviewQueryDto,
  ): Promise<ApiSuccessResponse<EmbeddingPreviewPayload>> {
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );

    const preview = await this.embeddingService.getPreview(query);

    return successResponseWithGeneratedAt(preview, {
      requestId: request.id,
    });
  }

  @TypedRoute.Get<string>('preview.svg')
  @UseGuards(AuthenticatedThrottlerGuard)
  async getPreviewSvg(
    @Req() _request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
    @TypedQuery() query: EmbeddingPreviewQueryDto,
  ): Promise<string> {
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');

    return this.embeddingService.getPreviewSvg(query);
  }
}
