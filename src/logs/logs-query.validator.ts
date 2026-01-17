import {
  LOGS_DEFAULT_LIMIT,
  LOGS_MAX_LIMIT,
  LOGS_MIN_LIMIT,
} from './logs.constants';
import { decodeLogsCursor, type LogsCursor } from './logs-cursor.util';
import { buildInvalidQueryException } from './logs.errors';
import { isLogAction, isLogCategory, type LogTypeFilter } from './logs.types';
import type { LogsQueryDto } from './dto/logs.query';

export type ValidatedLogsQuery = {
  limit: number;
  cursor?: string;
  cursorPayload?: LogsCursor;
  type?: LogTypeFilter;
  from?: Date;
  to?: Date;
};

const parseLimit = (rawLimit: number | string | undefined): number => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return LOGS_DEFAULT_LIMIT;
  }

  const parsed =
    typeof rawLimit === 'number' ? rawLimit : Number.parseInt(rawLimit, 10);

  if (!Number.isFinite(parsed)) {
    throw buildInvalidQueryException('limit 값이 숫자가 아닙니다.', {
      limit: rawLimit,
    });
  }

  if (parsed < LOGS_MIN_LIMIT || parsed > LOGS_MAX_LIMIT) {
    throw buildInvalidQueryException('limit 값이 허용 범위를 벗어났습니다.', {
      limit: rawLimit,
      min: LOGS_MIN_LIMIT,
      max: LOGS_MAX_LIMIT,
    });
  }

  return parsed;
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

const parseDateTime = (
  raw: string | undefined,
  label: 'from' | 'to',
): Date | undefined => {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (raw === '') {
    throw buildInvalidQueryException(`${label} 값은 비어 있을 수 없습니다.`, {
      [label]: raw,
    });
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw buildInvalidQueryException(
      `${label} 값은 ISO 8601 날짜 형식이어야 합니다.`,
      { [label]: raw },
    );
  }

  return parsed;
};

export const validateLogsQuery = (raw: LogsQueryDto): ValidatedLogsQuery => {
  const limit = parseLimit(raw.limit as number | string | undefined);
  const type = parseType(raw.type);
  const cursorPayload =
    raw.cursor !== undefined ? decodeLogsCursor(raw.cursor) : undefined;
  const from = parseDateTime(raw.from, 'from');
  const to = parseDateTime(raw.to, 'to');

  if (from && to && from.getTime() > to.getTime()) {
    throw buildInvalidQueryException('from 값이 to 값보다 클 수 없습니다.', {
      from: raw.from,
      to: raw.to,
    });
  }

  return {
    limit,
    type,
    cursor: raw.cursor,
    cursorPayload,
    from,
    to,
  };
};
