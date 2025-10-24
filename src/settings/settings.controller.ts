import { Controller, Inject, Res, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { TypedRoute } from '@nestia/core';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { SettingsService } from './settings.service';

@Controller('api/settings')
@UseInterceptors(ApiResponseInterceptor)
export class SettingsController {
  constructor(
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
  ) {}

  @TypedRoute.Get('profile')
  @Authenticated()
  async getProfile(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SettingsProfileResponse> {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return this.settingsService.getProfile(session);
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
