import {
  Controller,
  Inject,
  Query,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import type { EmbeddingPreviewQueryDto } from './dto/embedding-preview-request.dto';
import type { EmbeddingPreviewPayload } from './dto/embedding-preview-response.dto';
import { EmbeddingService } from './embedding.service';

@ApiTags('Embedding')
@Controller('api/embedding')
export class EmbeddingController {
  constructor(
    @Inject(EmbeddingService)
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get('preview')
  @UseGuards(AuthenticatedThrottlerGuard)
  async getPreview(
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
    @Query() query: EmbeddingPreviewQueryDto,
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

  @Get('preview.svg')
  @UseGuards(AuthenticatedThrottlerGuard)
  async getPreviewSvg(
    @Req() _request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
    @Query() query: EmbeddingPreviewQueryDto,
  ): Promise<string> {
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');

    return this.embeddingService.getPreviewSvg(query);
  }
}
