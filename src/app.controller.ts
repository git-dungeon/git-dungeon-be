import { Controller } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';

export interface HealthCheckResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

@Controller()
export class AppController {
  @TypedRoute.Get('health')
  public health(): HealthCheckResponse {
    return {
      status: 'ok',
      version: '0.0.1',
      timestamp: new Date().toISOString(),
    };
  }
}
