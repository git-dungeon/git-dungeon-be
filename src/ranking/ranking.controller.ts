import { Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TypedRoute } from '@nestia/core';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import { applyNoCacheHeaders } from '../common/http/response-helpers';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import { validateRankingQuery } from './ranking-query.validator';
import type { RankingResponse } from './dto/ranking.response';
import { RankingService } from './ranking.service';

@Controller('api')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @TypedRoute.Get<RankingResponse>('ranking')
  @UseGuards(AuthenticatedThrottlerGuard)
  async getRanking(
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<RankingResponse> {
    applyNoCacheHeaders(response);

    const query = validateRankingQuery(request.query);
    const data = await this.rankingService.getRanking({
      limit: query.limit,
      offset: query.cursorPayload?.offset,
    });

    return successResponseWithGeneratedAt(data, { requestId: request.id });
  }
}
