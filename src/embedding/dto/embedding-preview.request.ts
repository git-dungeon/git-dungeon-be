import type {
  EmbeddingPreviewLanguage,
  EmbeddingPreviewSize,
  EmbeddingPreviewTheme,
} from './embedding-preview.response';

export type {
  EmbeddingPreviewLanguage,
  EmbeddingPreviewSize,
  EmbeddingPreviewTheme,
} from './embedding-preview.response';

export interface EmbeddingPreviewQueryDto {
  userId: string;
  theme?: EmbeddingPreviewTheme;
  size?: EmbeddingPreviewSize;
  language?: EmbeddingPreviewLanguage;
  previewToken?: string;
}
