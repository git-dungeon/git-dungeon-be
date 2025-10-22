import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthSessionService } from '../auth-session.service.js';
import type { ActiveSessionResult } from '../auth-session.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthSessionService)
    private readonly authSessionService: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { authSession?: ActiveSessionResult }>();

    if (request.authSession) {
      return true;
    }

    const session = await this.authSessionService.requireActiveSession(request);

    request.authSession = session;

    return true;
  }
}
