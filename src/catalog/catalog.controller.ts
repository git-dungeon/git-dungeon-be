import {
  Controller,
  InternalServerErrorException,
  Logger,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { TypedRoute } from '@nestia/core';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import { loadCatalogData } from './index';
import type { CatalogData } from './catalog.schema';
import type { Request, Response } from 'express';

@Controller('api')
@UseGuards(AuthenticatedThrottlerGuard)
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  @TypedRoute.Get<ApiSuccessResponse<CatalogData>>('catalog')
  async getCatalog(
    @Req() req: Request & { id?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<CatalogData> | void> {
    try {
      const catalog = await loadCatalogData();
      const etag = `"catalog-${catalog.version}-${catalog.updatedAt}"`;
      const cacheControl =
        'public, max-age=3600, stale-while-revalidate=300, stale-if-error=3600';
      const ifNoneMatch = req.headers['if-none-match'];

      if (ifNoneMatch === etag) {
        res.status(304);
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', cacheControl);
        res.end();
        return;
      }

      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', cacheControl);

      return successResponseWithGeneratedAt(catalog, {
        requestId: req.id,
      });
    } catch (error) {
      this.logger.error('Failed to load catalog', error);
      throw new InternalServerErrorException({
        code: 'CATALOG_UNAVAILABLE',
        message: '카탈로그를 불러올 수 없습니다.',
      });
    }
  }
}
