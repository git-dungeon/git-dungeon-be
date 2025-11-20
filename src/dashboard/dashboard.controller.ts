import { Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TypedRoute } from '@nestia/core';
import type { ApiSuccessResponse } from '../common/http/api-response';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import type { DashboardStateResponse } from './dto/dashboard-state.response';
import { DashboardService } from './dashboard.service';

@Controller('api')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @TypedRoute.Get<ApiSuccessResponse<DashboardStateResponse>>('state')
  @Authenticated()
  async getState(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<DashboardStateResponse>> {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    const dashboard = await this.dashboardService.getState(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(dashboard, {
      requestId: request.id,
    });
  }

  private applyNoCacheHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }

  private appendCookies(response: Response, cookies: string[]): void {
    for (const cookie of cookies) {
      response.append('Set-Cookie', cookie);
    }
  }
}
