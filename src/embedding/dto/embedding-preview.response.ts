import { tags } from 'typia';
import type { ApiSuccessResponse } from '../../common/http/api-response';

export type EmbeddingPreviewTheme = 'light' | 'dark';
export type EmbeddingPreviewSize = 'compact' | 'wide';
export type EmbeddingPreviewLanguage = 'ko' | 'en';
export type EmbeddingPreviewRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';
export type EmbeddingPreviewSlot = 'helmet' | 'armor' | 'weapon' | 'ring';
export type EmbeddingPreviewStat =
  | 'hp'
  | 'maxHp'
  | 'atk'
  | 'def'
  | 'luck'
  | 'ap';

export interface EmbeddingPreviewPayload {
  theme: EmbeddingPreviewTheme;
  size: EmbeddingPreviewSize;
  language: EmbeddingPreviewLanguage;
  generatedAt: string & tags.Format<'date-time'>;
  overview: EmbeddingPreviewOverview;
}

export interface EmbeddingPreviewOverview {
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  exp: number;
  expToLevel: number;
  gold: number;
  ap: number;
  maxAp: number | null;
  floor: EmbeddingPreviewFloor;
  stats: EmbeddingPreviewStatSummary;
  equipment: EmbeddingPreviewEquipmentItem[];
}

export interface EmbeddingPreviewFloor {
  current: number;
  best: number;
  progress: number;
}

export interface EmbeddingPreviewStatSummary {
  total: EmbeddingPreviewStatBlock;
  base: EmbeddingPreviewStatBlock;
  equipmentBonus: EmbeddingPreviewStatBlock;
}

export interface EmbeddingPreviewStatBlock {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  ap: number;
}

export interface EmbeddingPreviewEquipmentItem {
  id: string & tags.Format<'uuid'>;
  code: string | null;
  name: string;
  slot: EmbeddingPreviewSlot;
  rarity: EmbeddingPreviewRarity;
  modifiers: EmbeddingPreviewModifier[];
  effect: EmbeddingPreviewEffect | null;
  sprite: string;
  createdAt: string & tags.Format<'date-time'>;
  isEquipped: boolean;
}

export interface EmbeddingPreviewModifier {
  stat: EmbeddingPreviewStat;
  value: number;
}

export interface EmbeddingPreviewEffect {
  type: string;
  description: string;
}

export type EmbeddingPreviewResponse =
  ApiSuccessResponse<EmbeddingPreviewPayload>;
