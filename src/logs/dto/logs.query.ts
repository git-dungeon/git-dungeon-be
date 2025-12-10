import { DungeonLogAction, DungeonLogCategory } from '@prisma/client';
import { tags } from 'typia';
import {
  LOGS_DEFAULT_LIMIT,
  LOGS_MAX_LIMIT,
  LOGS_MIN_LIMIT,
} from '../logs.constants';

export type DungeonLogTypeFilter = DungeonLogAction | DungeonLogCategory;

/**
 * `GET /api/logs` 쿼리 파라미터 DTO.
 * 커서 기반 페이지네이션 규칙을 typia 태그로 강제한다.
 */
export interface LogsQueryDto {
  limit?: number &
    tags.Minimum<typeof LOGS_MIN_LIMIT> &
    tags.Maximum<typeof LOGS_MAX_LIMIT> &
    tags.Default<typeof LOGS_DEFAULT_LIMIT> &
    tags.Example<typeof LOGS_DEFAULT_LIMIT>;
  cursor?: string &
    tags.MinLength<1> &
    tags.Example<'MjAyNS0xMi0xMFQwMDowMDowMC4wMDBafGQ1YzA0MGI0LTg0MzItNDljNC1hYzgwLTdlNmJhMTY4OGQ0ZQ'>;
  type?: DungeonLogTypeFilter & tags.Example<'BATTLE'>;
}
