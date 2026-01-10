import { Injectable } from '@nestjs/common';
import type { EmbeddingPreviewQueryDto } from './dto/embedding-preview.request';
import type { EmbeddingPreviewPayload } from './dto/embedding-preview.response';

@Injectable()
export class EmbeddingService {
  async getPreview(_query: EmbeddingPreviewQueryDto): Promise<EmbeddingPreviewPayload> {
    throw new Error('Embedding preview is not implemented.');
  }
}
