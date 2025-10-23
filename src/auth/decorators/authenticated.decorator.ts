import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';

/**
 * 보호가 필요한 라우트에 AuthGuard를 간단히 적용하기 위한 헬퍼.
 */
export const Authenticated = (): ClassDecorator & MethodDecorator =>
  applyDecorators(UseGuards(AuthGuard));
