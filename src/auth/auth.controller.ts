import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  async githubRedirect(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    const result = await this.authService.startGithubOAuth(request, redirect);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    for (const cookie of result.cookies) {
      response.append('Set-Cookie', cookie);
    }

    response.redirect(result.location);
  }

  @Get('github/redirect')
  githubRedirectFinalize(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('redirect') redirect?: string,
    @Query('origin') origin?: string,
    @Query('error') error?: string,
    @Query('mode') mode?: string,
  ): void {
    const target = this.authService.finalizeGithubRedirect({
      redirect,
      origin,
      mode: mode === 'error' ? 'error' : 'success',
      error,
    });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.redirect(target);
  }
}
