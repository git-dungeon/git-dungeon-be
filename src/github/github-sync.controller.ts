import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApSyncTokenType } from '@prisma/client';
import type { Request, Response } from 'express';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import {
  successResponseWithGeneratedAt,
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

  @Get('sync/status')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
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

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
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
