import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  successResponse,
  type ApiSuccessResponse,
} from './common/http/api-response';

export interface HealthCheckResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

@Controller()
export class AppController {
  @Get('health')
  public health(
    @Req() request: Request & { id?: string },
  ): ApiSuccessResponse<HealthCheckResponse> {
    return successResponse(
      {
        status: 'ok',
        version: '0.0.1',
        timestamp: new Date().toISOString(),
      },
      {
        requestId: request.id,
        generatedAt: new Date().toISOString(),
      },
    );
  }
}
