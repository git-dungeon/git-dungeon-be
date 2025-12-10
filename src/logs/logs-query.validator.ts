import {
  LOGS_DEFAULT_LIMIT,
  LOGS_MAX_LIMIT,
  LOGS_MIN_LIMIT,
} from './logs.constants';
import { decodeLogsCursor, type LogsCursor } from './logs-cursor.util';
import { buildInvalidQueryException } from './logs.errors';
import { isLogAction, isLogCategory, type LogTypeFilter } from './logs.types';
import type { LogsQueryDto } from './dto/logs.query';

export interface LogsQueryRaw {
  limit?: string | number | (string | number)[];
  cursor?: string | string[];
  type?: string | string[];
}

export type ValidatedLogsQuery = {
  limit: number;
  cursor?: string;
  cursorPayload?: LogsCursor;
  type?: LogTypeFilter;
};

export type LogsQueryInput = LogsQueryRaw | LogsQueryDto;

const parseLimit = (rawLimit: string | number | undefined): number => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return LOGS_DEFAULT_LIMIT;
  }

  const parsed =
    typeof rawLimit === 'number' ? rawLimit : Number.parseInt(rawLimit, 10);

  if (
    !Number.isInteger(parsed) ||
    parsed < LOGS_MIN_LIMIT ||
    parsed > LOGS_MAX_LIMIT
  ) {
    throw buildInvalidQueryException(
      `limit은 ${LOGS_MIN_LIMIT}~${LOGS_MAX_LIMIT} 사이의 정수여야 합니다.`,
      { limit: rawLimit },
    );
  }

  return parsed;
};

const parseType = (rawType: string | undefined): LogTypeFilter | undefined => {
  if (rawType === undefined || rawType === null || rawType === '') {
    return undefined;
  }

  if (isLogAction(rawType) || isLogCategory(rawType)) {
    return rawType;
  }

  throw buildInvalidQueryException('지원하지 않는 type 값입니다.', {
    type: rawType,
  });
};

export const validateLogsQuery = (raw: LogsQueryInput): ValidatedLogsQuery => {
  const limitRaw = Array.isArray(raw.limit) ? raw.limit[0] : raw.limit;
  const typeRaw = Array.isArray(raw.type) ? raw.type[0] : raw.type;
  const cursor = Array.isArray(raw.cursor) ? raw.cursor[0] : raw.cursor;

  const limit = parseLimit(limitRaw);
  const type = parseType(typeRaw);
  const cursorPayload =
    cursor !== undefined ? decodeLogsCursor(cursor) : undefined;

  return {
    limit,
    type,
    cursor,
    cursorPayload,
  };
};
