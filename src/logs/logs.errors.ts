import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

export const LOGS_ERROR_CODES = {
  INVALID_QUERY: 'LOGS_INVALID_QUERY',
  CURSOR_NOT_FOUND: 'LOGS_CURSOR_NOT_FOUND',
  RATE_LIMITED: 'LOGS_RATE_LIMITED',
} as const;

export const LOGS_ERROR_MESSAGES = {
  INVALID_QUERY: '잘못된 로그 조회 요청입니다.',
  CURSOR_NOT_FOUND: '요청한 커서를 찾을 수 없습니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
} as const;

export const buildInvalidQueryException = (
  message: string = LOGS_ERROR_MESSAGES.INVALID_QUERY,
  details?: unknown,
): BadRequestException =>
  new BadRequestException({
    error: {
      code: LOGS_ERROR_CODES.INVALID_QUERY,
      message,
      details,
    },
  });

export const buildCursorNotFoundException = (
  message: string = LOGS_ERROR_MESSAGES.CURSOR_NOT_FOUND,
  details?: unknown,
): NotFoundException =>
  new NotFoundException({
    error: {
      code: LOGS_ERROR_CODES.CURSOR_NOT_FOUND,
      message,
      details,
    },
  });

export const buildRateLimitedException = (
  message: string = LOGS_ERROR_MESSAGES.RATE_LIMITED,
  details?: unknown,
): HttpException =>
  new HttpException(
    {
      error: {
        code: LOGS_ERROR_CODES.RATE_LIMITED,
        message,
        details,
      },
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
