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
}
