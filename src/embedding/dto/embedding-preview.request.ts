import { tags } from 'typia';

export type EmbeddingPreviewTheme = 'light' | 'dark';
export type EmbeddingPreviewSize = 'compact' | 'wide';
export type EmbeddingPreviewLanguage = 'ko' | 'en';

export interface EmbeddingPreviewQueryDto {
  userId: string & tags.Format<'uuid'>;
  theme?: EmbeddingPreviewTheme;
  size?: EmbeddingPreviewSize;
  language?: EmbeddingPreviewLanguage;
  previewToken?: string;
}
