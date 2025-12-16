import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { TypedRoute, TypedException } from '@nestia/core';
import { ApSyncTokenType } from '@prisma/client';
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
import type {
  GithubSyncDataDto,
  GithubSyncMetaDto,
  GithubSyncStatusDto,
  GithubSyncTokenType,
} from './dto/github-sync.dto';

@Controller('api/github')
@UseGuards(AuthenticatedThrottlerGuard)
export class GithubSyncController {
  constructor(
    @Inject(GithubManualSyncService)
    private readonly manualSyncService: GithubManualSyncService,
  ) {}

  @TypedRoute.Get<ApiSuccessResponse<GithubSyncStatusDto>>('sync/status')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @TypedException<ApiErrorResponse>({
    status: 401,
    description: '세션 쿠키가 없거나 만료된 경우',
  })
  @TypedException<ApiErrorResponse>({
    status: 429,
    description: '요청 한도 초과',
  })
  async getSyncStatus(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<GithubSyncStatusDto>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const status = await this.manualSyncService.getSyncStatus(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(status, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<GithubSyncDataDto>>('sync')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
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
      '수동 동기화 쿨다운(GITHUB_SYNC_TOO_FREQUENT) 또는 GitHub 레이트 리밋(GITHUB_SYNC_RATE_LIMITED)',
  })
  @TypedException<ApiErrorResponse>({
    status: 409,
    description: '동일 사용자의 GitHub 동기화가 이미 실행 중인 경우',
  })
  async triggerSync(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<GithubSyncDataDto>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const result = await this.manualSyncService.syncNow(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(this.toSyncDataDto(result), {
      requestId: request.id,
    });
  }

  private toSyncDataDto(result: GithubSyncResponse): GithubSyncDataDto {
    const tokenType: GithubSyncTokenType =
      result.tokenType === ApSyncTokenType.PAT ? 'pat' : 'oauth';

    const rateLimit = result.meta?.rateLimit ?? null;
    const meta: GithubSyncMetaDto = {
      remaining: rateLimit?.remaining ?? null,
      resetAt: rateLimit?.resetAt ?? null,
      resource: rateLimit?.resource ?? null,
    };

    return {
      contributions: result.contributions,
      windowStart: result.windowStart,
      windowEnd: result.windowEnd,
      tokenType,
      rateLimitRemaining: result.rateLimitRemaining ?? null,
      logId: result.logId,
      meta,
    };
  }
}
