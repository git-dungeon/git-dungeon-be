import { LogTypeEnum } from '../logs.types';

/**
 * `GET /api/logs` 쿼리 파라미터 DTO.
 * 런타임 제약 검증은 OpenAPI/Ajv 및 `validateLogsQuery`에서 처리한다.
 */
export interface LogsQueryDto {
  limit?: number;
  cursor?: string;
  type?: LogTypeEnum;
  from?: string;
  to?: string;
}
