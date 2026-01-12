import { tags } from 'typia';
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
  userId: string & tags.Format<'uuid'>;
  theme?: EmbeddingPreviewTheme;
  size?: EmbeddingPreviewSize;
  language?: EmbeddingPreviewLanguage;
  previewToken?: string;
}
