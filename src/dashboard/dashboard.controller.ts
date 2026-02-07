import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
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
import type { DashboardStateResponse } from './dto/dashboard-state.response';
import { DashboardService } from './dashboard.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';

@Controller('api')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('state')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async getState(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<DashboardStateResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const dashboard = await this.dashboardService.getState(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(dashboard, {
      requestId: request.id,
    });
  }
}
