import type {
  EmbeddingPreviewLanguage,
  EmbeddingPreviewSize,
  EmbeddingPreviewTheme,
} from './embedding-preview-response.dto';

export type {
  EmbeddingPreviewLanguage,
  EmbeddingPreviewSize,
  EmbeddingPreviewTheme,
} from './embedding-preview-response.dto';

export interface EmbeddingPreviewQueryDto {
  userId: string;
  theme?: EmbeddingPreviewTheme;
  size?: EmbeddingPreviewSize;
  language?: EmbeddingPreviewLanguage;
  previewToken?: string;
}
