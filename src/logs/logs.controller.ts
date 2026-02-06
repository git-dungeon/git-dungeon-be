import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { validateLogsQuery } from './logs-query.validator';
import type { LogsQueryDto } from './dto/logs.query';
import { LogTypeEnum } from './logs.types';

@ApiTags('Logs')
@Controller('api')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('logs')
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
    description: '다음 페이지를 가리키는 base64url 커서(sequence 기반)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: LogTypeEnum,
    enumName: 'LogType',
    description: '액션/카테고리 필터(DungeonLogAction | DungeonLogCategory)',
  })
  async getLogs(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id: string },
    @Res({ passthrough: true }) response: Response,
    @Query() query: LogsQueryDto,
  ): Promise<ApiSuccessResponse<DungeonLogsPayload>> {
    applyNoCacheHeaders(response);

    const validatedQuery = validateLogsQuery(query);

    const result = await this.logsService.getLogs({
      userId: session.view.session.userId,
      ...validatedQuery,
    });

    return successResponseWithGeneratedAt(result, { requestId: request.id });
  }
}
