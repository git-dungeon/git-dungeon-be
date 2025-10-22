import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthSessionService } from '../auth-session.service.js';
import type { ActiveSessionResult } from '../auth-session.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.authenticate(request);

    request.authSession = session;

    return true;
  }

  private authenticate(request: Request): Promise<ActiveSessionResult> {
    return this.authSessionService.requireActiveSession(request);
  }
}
