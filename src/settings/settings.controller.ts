import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import type { ApiSuccessResponse } from '../common/http/api-response';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
  ) {}

  @Get('profile')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async getProfile(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<SettingsProfileResponse>> {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    const profile = await this.settingsService.getProfile(session);

    return successResponseWithGeneratedAt(profile, {
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
