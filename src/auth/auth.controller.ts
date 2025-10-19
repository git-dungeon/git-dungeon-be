import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type {
  GitHubPopupAuthRequest,
  GitHubPopupAuthResponse,
} from './auth.interfaces.js';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  async githubRedirect(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('redirect') redirect?: string,
    @Query('popup') popup?: string,
    @Query('parent') parent?: string,
  ): Promise<void> {
    const result = await this.authService.startGithubOAuth(request, {
      redirect,
      popup,
      parent,
    });

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    for (const cookie of result.cookies) {
      response.append('Set-Cookie', cookie);
    }

    response.redirect(result.location);
  }

  @Post('github')
  @UseInterceptors(ApiResponseInterceptor)
  @HttpCode(200)
  async githubPopup(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: GitHubPopupAuthRequest,
  ): Promise<GitHubPopupAuthResponse> {
    const result = await this.authService.completeGithubOAuth(request, body);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    for (const cookie of result.cookies) {
      response.append('Set-Cookie', cookie);
    }

    return result.payload;
  }
}
