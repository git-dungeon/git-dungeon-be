import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiSuccessResponse } from '../common/http/api-response';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import {
  appendCookies,
  applyNoCacheHeaders,
} from '../common/http/response-helpers';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import type { LevelUpApplyRequest } from './dto/level-up-request.dto';
import type {
  LevelUpApplyResponse,
  LevelUpSelectionResponse,
} from './dto/level-up-response.dto';
import { LevelUpService } from './level-up.service';

@Controller('api')
export class LevelUpController {
  constructor(private readonly levelUpService: LevelUpService) {}

  @Get('level-up')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async getLevelUpSelection(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<LevelUpSelectionResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const selection = await this.levelUpService.getSelection(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(selection, {
      requestId: request.id,
    });
  }

  @Post('level-up/select')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async applyLevelUpSelection(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Body() body: LevelUpApplyRequest,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<LevelUpApplyResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const result = await this.levelUpService.applySelection(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(result, {
      requestId: request.id,
    });
  }
}
