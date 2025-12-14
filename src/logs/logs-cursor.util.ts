import { LOGS_CURSOR_ENCODING } from './logs.constants';
import { buildInvalidQueryException } from './logs.errors';

export interface LogsCursor {
  sequence: bigint;
}

const createCursorString = (payload: LogsCursor): string =>
  payload.sequence.toString(10);

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

    if (!decoded) {
      throw new Error('cursor payload is empty');
    }

    if (!/^\d+$/.test(decoded)) {
      throw new Error('cursor sequence is not a decimal integer');
    }

    const sequence = BigInt(decoded);
    if (sequence < 1n) {
      throw new Error('cursor sequence must be >= 1');
    }

    return { sequence };
  } catch (error) {
    throw buildInvalidQueryException('cursor 형식이 잘못되었습니다.', {
      reason:
        error instanceof Error ? error.message : 'unknown cursor parse error',
    });
  }
};
