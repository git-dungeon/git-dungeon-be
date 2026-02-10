import type { LevelUpStat } from './level-up-response.dto';

export interface LevelUpApplyRequest {
  stat: LevelUpStat;
  rollIndex: number;
}
