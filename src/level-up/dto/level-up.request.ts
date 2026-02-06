import type { LevelUpStat } from './level-up.response';

export interface LevelUpApplyRequest {
  stat: LevelUpStat;
  rollIndex: number;
}
