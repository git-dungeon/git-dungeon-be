import {
  RANKING_DEFAULT_LIMIT,
  RANKING_MAX_LIMIT,
  RANKING_MIN_LIMIT,
} from './ranking.constants';
import { decodeRankingCursor, type RankingCursor } from './ranking-cursor.util';
import { buildInvalidQueryException } from './ranking.errors';
import type { RankingQueryDto } from './dto/ranking-query.dto';

export type ValidatedRankingQuery = {
  limit: number;
  cursor?: string;
  cursorPayload?: RankingCursor;
};

const parseLimit = (rawLimit: number | string | undefined): number => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return RANKING_DEFAULT_LIMIT;
  }

  const parsed = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw buildInvalidQueryException('limit 값이 숫자가 아닙니다.', {
      limit: rawLimit,
    });
  }

  if (parsed < RANKING_MIN_LIMIT || parsed > RANKING_MAX_LIMIT) {
    throw buildInvalidQueryException('limit 값이 허용 범위를 벗어났습니다.', {
      limit: rawLimit,
      min: RANKING_MIN_LIMIT,
      max: RANKING_MAX_LIMIT,
    });
  }

  return parsed;
};

export const validateRankingQuery = (
  raw: RankingQueryDto,
): ValidatedRankingQuery => {
  const limit = parseLimit(raw.limit as number | string | undefined);
  const cursorPayload =
    raw.cursor !== undefined ? decodeRankingCursor(raw.cursor) : undefined;

  return {
    limit,
    cursor: raw.cursor,
    cursorPayload,
  };
};
