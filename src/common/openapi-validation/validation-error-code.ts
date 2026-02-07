import { DEFAULT_OPENAPI_VALIDATION_ERROR_CODE } from './openapi-validation.constants';
import {
  buildIndexKey,
  type OpenApiOperationSpec,
} from './openapi-operation-index';

export type OpenApiValidationErrorShape = {
  code: string;
  message: string;
};

const DEFAULT_ERROR: OpenApiValidationErrorShape = {
  code: DEFAULT_OPENAPI_VALIDATION_ERROR_CODE,
  message: '요청 형식이 잘못되었습니다.',
};

const ERROR_OVERRIDES: ReadonlyMap<string, OpenApiValidationErrorShape> =
  new Map([
    [
      buildIndexKey('get', '/api/logs'),
      { code: 'LOGS_INVALID_QUERY', message: '잘못된 로그 조회 요청입니다.' },
    ],
    [
      buildIndexKey('get', '/api/ranking'),
      {
        code: 'RANKING_INVALID_QUERY',
        message: '잘못된 랭킹 조회 요청입니다.',
      },
    ],
  ]);

export const resolveOpenApiValidationErrorShape = (
  operation: OpenApiOperationSpec,
): OpenApiValidationErrorShape => {
  return (
    ERROR_OVERRIDES.get(buildIndexKey(operation.method, operation.path)) ??
    DEFAULT_ERROR
  );
};
