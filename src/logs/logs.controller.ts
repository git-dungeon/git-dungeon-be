import { Controller, Query, Req, Res, UseGuards } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';
import type { Request, Response } from 'express';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import type { DungeonLogsPayload } from './dto/logs.response';
import { LogsService } from './logs.service';
import { validateLogsQuery } from './logs-query.validator';

@Controller('api')
@UseGuards(AuthenticatedThrottlerGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @TypedRoute.Get<ApiSuccessResponse<DungeonLogsPayload>>('logs')
  @Authenticated()
  async getLogs(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<DungeonLogsPayload>> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    const validatedQuery = validateLogsQuery(query);

    const result = await this.logsService.getLogs({
      userId: session.view.session.userId,
      ...validatedQuery,
    });

    return successResponseWithGeneratedAt(result, { requestId: request.id });
  }
}
