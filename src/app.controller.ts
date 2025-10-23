import { Controller, UseInterceptors } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

export interface HealthCheckResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

@Controller()
@UseInterceptors(ApiResponseInterceptor)
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
