import { tags } from 'typia';
import {
  RANKING_DEFAULT_LIMIT,
  RANKING_MAX_LIMIT,
  RANKING_MIN_LIMIT,
} from '../ranking.constants';

/**
 * `GET /api/ranking` 쿼리 파라미터 DTO.
 * 커서 기반 페이지네이션 규칙을 typia 태그로 강제한다.
 */
export interface RankingQueryDto {
  limit?: number &
    tags.Minimum<typeof RANKING_MIN_LIMIT> &
    tags.Maximum<typeof RANKING_MAX_LIMIT> &
    tags.Default<typeof RANKING_DEFAULT_LIMIT> &
    tags.Example<typeof RANKING_DEFAULT_LIMIT>;
  cursor?: string & tags.MinLength<1> & tags.Example<'MTA'>;
}
