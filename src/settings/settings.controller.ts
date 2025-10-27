import { Controller, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TypedException, TypedRoute } from '@nestia/core';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../common/http/api-response';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
  ) {}

  @TypedRoute.Get<ApiSuccessResponse<SettingsProfileResponse>>('profile')
  @TypedException<ApiErrorResponse>({
    status: 401,
    description: '세션 쿠키가 없거나 만료된 경우',
  })
  @TypedException<ApiErrorResponse>({
    status: 500,
    description: '프로필 응답을 생성하지 못한 경우',
  })
  @Authenticated()
  async getProfile(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<SettingsProfileResponse>> {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    const profile = await this.settingsService.getProfile(session);

    return successResponseWithGeneratedAt(profile);
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
