import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

export const RANKING_ERROR_CODES = {
  INVALID_QUERY: 'RANKING_INVALID_QUERY',
  RATE_LIMITED: 'RANKING_RATE_LIMITED',
} as const;

export const RANKING_ERROR_MESSAGES = {
  INVALID_QUERY: '잘못된 랭킹 조회 요청입니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
} as const;

export const buildInvalidQueryException = (
  message: string = RANKING_ERROR_MESSAGES.INVALID_QUERY,
  details?: unknown,
): BadRequestException =>
  new BadRequestException({
    error: {
      code: RANKING_ERROR_CODES.INVALID_QUERY,
      message,
      details,
    },
  });

export const buildRateLimitedException = (
  message: string = RANKING_ERROR_MESSAGES.RATE_LIMITED,
  details?: unknown,
): HttpException =>
  new HttpException(
    {
      error: {
        code: RANKING_ERROR_CODES.RATE_LIMITED,
        message,
        details,
      },
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
