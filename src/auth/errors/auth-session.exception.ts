import { UnauthorizedException } from '@nestjs/common';

interface AuthSessionExceptionPayload {
  code: 'AUTH_SESSION_EXPIRED' | 'AUTH_SESSION_INVALID';
  message: string;
}

abstract class AuthSessionException extends UnauthorizedException {
  protected constructor(payload: AuthSessionExceptionPayload) {
    super({ success: false, error: payload });
  }
}

export class AuthSessionExpiredException extends AuthSessionException {
  constructor(message = '세션이 만료되었습니다. 다시 로그인해 주세요.') {
    super({
      code: 'AUTH_SESSION_EXPIRED',
      message,
    });
  }
}

export class AuthSessionInvalidException extends AuthSessionException {
  constructor(message = '유효하지 않은 세션입니다. 다시 로그인해 주세요.') {
    super({
      code: 'AUTH_SESSION_INVALID',
      message,
    });
  }
}
