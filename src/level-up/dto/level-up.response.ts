export type LevelUpStat = 'hp' | 'atk' | 'def' | 'luck';

export type LevelUpRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface LevelUpOption {
  stat: LevelUpStat;
  rarity: LevelUpRarity;
  value: number;
}

export interface LevelUpSelectionResponse {
  points: number;
  rollIndex: number;
  options: LevelUpOption[];
}

export interface LevelUpStatBlock {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
}

export interface LevelUpApplyResponse {
  points: number;
  rollIndex: number;
  applied: LevelUpOption;
  stats: LevelUpStatBlock;
}
