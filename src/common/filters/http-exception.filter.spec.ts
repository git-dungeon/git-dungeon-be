import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { PinoLogger } from 'nestjs-pino';
import { HttpExceptionFilter } from './http-exception.filter.js';

const createHost = (response: Response, request: unknown): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  }) as ArgumentsHost;

const createLogger = () => {
  const error = vi.fn();
  const logger = { error } as unknown as PinoLogger;
  return { logger, error };
};

describe('HttpExceptionFilter', () => {
  it('should format HttpException into ApiResponse', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const response = { status } as unknown as Response;
    const request = { id: 'req-123', url: '/health' };
    const { logger, error } = createLogger();

    const filter = new HttpExceptionFilter(logger);
    const exception = new HttpException(
      {
        message: 'Invalid payload',
        code: 'VALIDATION_ERROR',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, createHost(response, request));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
