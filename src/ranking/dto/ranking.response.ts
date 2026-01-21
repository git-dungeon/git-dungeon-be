import { tags } from 'typia';
import type { ApiSuccessResponse } from '../../common/http/api-response';

export interface RankingEntry {
  rank: number & tags.Minimum<1> & tags.Example<1>;
  displayName?: (string & tags.Example<'PixelHero'>) | null;
  avatarUrl?:
    | (string &
        tags.Format<'uri'> &
        tags.Example<'https://avatars.githubusercontent.com/u/1?v=4'>)
    | null;
  level: number & tags.Minimum<1> & tags.Example<25>;
  maxFloor: number & tags.Minimum<1> & tags.Example<30>;
}

export interface RankingPayload {
  rankings: RankingEntry[];
  nextCursor: (string & tags.MinLength<1>) | null;
}
