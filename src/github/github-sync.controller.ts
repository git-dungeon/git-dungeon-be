import { Controller, Req, Res, UseGuards } from '@nestjs/common';
import { TypedRoute, TypedException } from '@nestia/core';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import {
  successResponseWithGeneratedAt,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import {
  appendCookies,
  applyNoCacheHeaders,
} from '../common/http/response-helpers';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import { GithubManualSyncService } from './github-sync.manual.service';
import type { GithubSyncResponse } from './github.interfaces';

@Controller('api/github')
@UseGuards(AuthenticatedThrottlerGuard)
export class GithubSyncController {
  constructor(private readonly manualSyncService: GithubManualSyncService) {}

  @TypedRoute.Post<ApiSuccessResponse<GithubSyncResponse>>('sync')
  @Authenticated()
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @TypedException<ApiErrorResponse>({
    status: 400,
    description: 'GitHub 계정이 연결되지 않은 경우',
  })
  @TypedException<ApiErrorResponse>({
    status: 401,
    description: '세션 쿠키가 없거나 만료된 경우',
  })
  @TypedException<ApiErrorResponse>({
    status: 429,
    description:
      '수동 동기화 쿨다운 또는 GitHub 레이트 리밋에 걸린 경우(코드: GITHUB_SYNC_RATE_LIMITED)',
  })
  async triggerSync(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<GithubSyncResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const result = await this.manualSyncService.syncNow(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(result, {
      requestId: request.id,
    });
  }
}
