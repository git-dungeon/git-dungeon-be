import { Controller, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { applyNoCacheHeaders } from '../common/http/response-helpers';
import type { DungeonLogsPayload } from './dto/logs.response';
import { LogsService } from './logs.service';
import { validateLogsQuery, type LogsQueryRaw } from './logs-query.validator';

@ApiTags('Logs')
@Controller('api')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @TypedRoute.Get<ApiSuccessResponse<DungeonLogsPayload>>('logs')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '한 번에 조회할 로그 개수(기본 10, 최대 50)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: '다음 페이지를 가리키는 base64 커서',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: '액션/카테고리 필터(DungeonLogAction | DungeonLogCategory)',
  })
  async getLogs(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id: string },
    @Res({ passthrough: true }) response: Response,
    @Query() rawQuery: LogsQueryRaw,
  ): Promise<ApiSuccessResponse<DungeonLogsPayload>> {
    applyNoCacheHeaders(response);

    const validatedQuery = validateLogsQuery(rawQuery);

    const result = await this.logsService.getLogs({
      userId: session.view.session.userId,
      ...validatedQuery,
    });

    return successResponseWithGeneratedAt(result, { requestId: request.id });
  }
}
