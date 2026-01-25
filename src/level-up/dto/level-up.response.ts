import type { tags } from 'typia';

export type LevelUpStat = 'hp' | 'atk' | 'def' | 'luck';

export type LevelUpRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface LevelUpOption {
  stat: LevelUpStat & tags.Example<'atk'>;
  rarity: LevelUpRarity & tags.Example<'rare'>;
  value: number & tags.Minimum<1> & tags.Example<3>;
}

export interface LevelUpSelectionResponse {
  points: number & tags.Minimum<0> & tags.Example<2>;
  rollIndex: number & tags.Minimum<0> & tags.Example<0>;
  options: LevelUpOption[];
}

export interface LevelUpStatBlock {
  hp: number & tags.Example<32>;
  maxHp: number & tags.Example<40>;
  atk: number & tags.Example<18>;
  def: number & tags.Example<14>;
  luck: number & tags.Example<6>;
}

export interface LevelUpApplyResponse {
  points: number & tags.Minimum<0> & tags.Example<1>;
  rollIndex: number & tags.Minimum<0> & tags.Example<1>;
  applied: LevelUpOption;
  stats: LevelUpStatBlock;
}
