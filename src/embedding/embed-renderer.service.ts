import { Injectable, Logger } from '@nestjs/common';
import path from 'node:path';
import type { EmbedFontConfig } from '@git-dungeon/embed-renderer';
import {
  renderEmbedSvg,
  type CharacterOverview,
  type InventoryItem,
} from '@git-dungeon/embed-renderer';
import {
  loadFontsFromFiles,
  type ServerFontSource,
} from '@git-dungeon/embed-renderer/server';
import type {
  EmbeddingPreviewEquipmentItem,
  EmbeddingPreviewOverview,
  EmbeddingPreviewPayload,
} from './dto/embedding-preview-response.dto';

@Injectable()
export class EmbedRendererService {
  private readonly logger = new Logger(EmbedRendererService.name);
  private cachedFonts: EmbedFontConfig[] | null = null;
  private pendingFonts: Promise<EmbedFontConfig[]> | null = null;

  async renderPreviewSvg(payload: EmbeddingPreviewPayload): Promise<string> {
    const fonts = await this.ensureFonts();
    const overview = this.toRendererOverview(payload.overview);

    return renderEmbedSvg({
      theme: payload.theme,
      size: payload.size,
      language: payload.language,
      overview,
      fonts,
    });
  }

  private async ensureFonts(): Promise<EmbedFontConfig[]> {
    if (this.cachedFonts) {
      return this.cachedFonts;
    }

    if (!this.pendingFonts) {
      const fontsDir = this.resolveFontsDir();
      const sources: ServerFontSource[] = [
        {
          name: 'DungGeunMo Thin',
          path: path.join(fontsDir, 'ThinDungGeunMo.ttf'),
          weight: 400,
          style: 'normal',
        },
        {
          name: 'DungGeunMo Bold',
          path: path.join(fontsDir, 'BoldDunggeunmo.ttf'),
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Noto Sans KR',
          path: path.join(fontsDir, 'NotoSansKR-Regular.otf'),
          weight: 400,
          style: 'normal',
        },
      ];

      this.pendingFonts = loadFontsFromFiles(sources)
        .then((fonts) => {
          this.cachedFonts = fonts;
          return fonts;
        })
        .catch((error) => {
          this.cachedFonts = [];
          this.logger.error(
            'Embed font loading failed; falling back to system fonts.',
            error instanceof Error ? error.stack : String(error),
          );
          return [];
        })
        .finally(() => {
          this.pendingFonts = null;
        });
    }

    return this.pendingFonts;
  }

  private toRendererOverview(
    overview: EmbeddingPreviewOverview,
  ): CharacterOverview {
    return {
      displayName: overview.displayName ?? undefined,
      avatarUrl: overview.avatarUrl ?? undefined,
      level: overview.level,
      exp: overview.exp,
      expToLevel: overview.expToLevel,
      gold: overview.gold,
      ap: overview.ap,
      maxAp: overview.maxAp ?? undefined,
      floor: overview.floor,
      stats: overview.stats,
      equipment: overview.equipment.map((item) => this.toRendererItem(item)),
    };
  }

  private toRendererItem(item: EmbeddingPreviewEquipmentItem): InventoryItem {
    const code =
      typeof item.code === 'string' && item.code.trim() ? item.code : undefined;
    const effect = item.effect ?? undefined;

    return {
      id: item.id,
      ...(code ? { code } : {}),
      name: item.name,
      slot: item.slot,
      rarity: item.rarity,
      modifiers: item.modifiers,
      ...(effect ? { effect } : {}),
      sprite: item.sprite,
      createdAt: item.createdAt,
      isEquipped: item.isEquipped,
    };
  }

  private resolveFontsDir(): string {
    return path.resolve(process.cwd(), 'assets', 'fonts');
  }
}
