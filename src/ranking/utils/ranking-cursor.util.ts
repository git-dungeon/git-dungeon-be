import { RANKING_CURSOR_ENCODING } from '../ranking.constants';
import { buildInvalidQueryException } from '../ranking.errors';

export interface RankingCursor {
  offset: number;
}

const createCursorString = (payload: RankingCursor): string =>
  payload.offset.toString(10);

export const encodeRankingCursor = (payload: RankingCursor): string => {
  const raw = createCursorString(payload);
  return Buffer.from(raw, 'utf8').toString(RANKING_CURSOR_ENCODING);
};

export const decodeRankingCursor = (
  cursor: string | undefined,
): RankingCursor => {
  if (!cursor) {
    throw buildInvalidQueryException('cursor는 비어 있을 수 없습니다.');
  }

  try {
    const decoded = Buffer.from(cursor, RANKING_CURSOR_ENCODING).toString(
      'utf8',
    );

    if (!decoded) {
      throw new Error('cursor payload is empty');
    }

    if (!/^\d+$/.test(decoded)) {
      throw new Error('cursor offset is not a decimal integer');
    }

    const offset = Number.parseInt(decoded, 10);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new Error('cursor offset must be >= 0');
    }

    return { offset };
  } catch (error) {
    throw buildInvalidQueryException('cursor 형식이 잘못되었습니다.', {
      reason:
        error instanceof Error ? error.message : 'unknown cursor parse error',
    });
  }
};
