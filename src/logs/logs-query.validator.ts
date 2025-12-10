import { LOGS_DEFAULT_LIMIT } from './logs.constants';
import { decodeLogsCursor, type LogsCursor } from './logs-cursor.util';
import { buildInvalidQueryException } from './logs.errors';
import { isLogAction, isLogCategory, type LogTypeFilter } from './logs.types';
import type { LogsQueryDto } from './dto/logs.query';

export type ValidatedLogsQuery = {
  limit: number;
  cursor?: string;
  cursorPayload?: LogsCursor;
  type?: LogTypeFilter;
};

const parseLimit = (rawLimit: number | undefined): number => {
  if (rawLimit === undefined || rawLimit === null) {
    return LOGS_DEFAULT_LIMIT;
  }

  return rawLimit;
};

const parseType = (rawType: string | undefined): LogTypeFilter | undefined => {
  if (rawType === undefined || rawType === null) {
    return undefined;
  }

  if (rawType === '') {
    throw buildInvalidQueryException('type 값은 비어 있을 수 없습니다.', {
      type: rawType,
    });
  }

  if (isLogAction(rawType) || isLogCategory(rawType)) {
    return rawType;
  }

  throw buildInvalidQueryException('지원하지 않는 type 값입니다.', {
    type: rawType,
  });
};

export const validateLogsQuery = (raw: LogsQueryDto): ValidatedLogsQuery => {
  const limit = parseLimit(raw.limit);
  const type = parseType(raw.type);
  const cursorPayload =
    raw.cursor !== undefined ? decodeLogsCursor(raw.cursor) : undefined;

  return {
    limit,
    type,
    cursor: raw.cursor,
    cursorPayload,
  };
};
