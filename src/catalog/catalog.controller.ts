import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import { computeCatalogHash, loadCatalogData } from './index';
import type { CatalogData } from './catalog.schema';
import type { Request, Response } from 'express';

type CatalogPublicData = Omit<CatalogData, 'dropTables'>;

@ApiTags('Catalog')
@Controller('api')
@UseGuards(AuthenticatedThrottlerGuard)
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  @Get('catalog')
  @ApiQuery({
    name: 'locale',
    required: false,
    type: String,
    description:
      '번역 문자열을 포함할 경우 사용할 locale. 기본 en. locale이 없으면 키/기본 문자열만 반환한다.',
  })
  async getCatalog(
    @Req() req: Request & { id?: string },
    @Res({ passthrough: true }) res: Response,
    @Query('locale') locale?: string,
  ): Promise<ApiSuccessResponse<CatalogPublicData> | void> {
    try {
      const resolvedLocale = locale ?? 'en';
      const includeStrings = locale !== undefined;
      const catalog = await loadCatalogData(undefined, undefined, {
        locale: resolvedLocale,
        includeStrings,
      });
      const { dropTables: _dropTables, ...publicCatalog } = catalog;

      const etag = `"catalog-${computeCatalogHash(catalog)}"`;
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

      return successResponseWithGeneratedAt(publicCatalog, {
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
