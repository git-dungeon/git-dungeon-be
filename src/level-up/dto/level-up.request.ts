import { tags } from 'typia';
import type { LevelUpStat } from './level-up.response';

export interface LevelUpApplyRequest {
  stat: LevelUpStat & tags.Example<'atk'>;
  rollIndex: number & tags.Minimum<0> & tags.Example<0>;
}
