import { LOGS_CURSOR_ENCODING, LOGS_CURSOR_SEPARATOR } from './logs.constants';
import { buildInvalidQueryException } from './logs.errors';

export interface LogsCursor {
  createdAt: Date;
  id: string;
}

const createCursorString = (payload: LogsCursor): string =>
  `${payload.createdAt.toISOString()}${LOGS_CURSOR_SEPARATOR}${payload.id}`;

export const encodeLogsCursor = (payload: LogsCursor): string => {
  const raw = createCursorString(payload);
  return Buffer.from(raw, 'utf8').toString(LOGS_CURSOR_ENCODING);
};

export const decodeLogsCursor = (cursor: string | undefined): LogsCursor => {
  if (!cursor) {
    throw buildInvalidQueryException('cursor는 비어 있을 수 없습니다.');
  }

  try {
    const decoded = Buffer.from(cursor, LOGS_CURSOR_ENCODING).toString('utf8');
    const [createdAtRaw, id] = decoded.split(LOGS_CURSOR_SEPARATOR);

    if (!createdAtRaw || !id) {
      throw new Error('cursor payload is missing fields');
    }

    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('cursor createdAt is invalid');
    }

    return { createdAt, id };
  } catch (error) {
    throw buildInvalidQueryException('cursor 형식이 잘못되었습니다.', {
      reason:
        error instanceof Error ? error.message : 'unknown cursor parse error',
    });
  }
};
