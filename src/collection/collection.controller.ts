import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import {
  appendCookies,
  applyNoCacheHeaders,
} from '../common/http/response-helpers';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import type { CollectionResponse } from './dto/collection-response.dto';
import { CollectionService } from './collection.service';

@Controller('api')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get('collection')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async getCollection(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<CollectionResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const collection = await this.collectionService.getCollection(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(collection, {
      requestId: request.id,
    });
  }
}
