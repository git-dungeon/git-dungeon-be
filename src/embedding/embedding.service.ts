import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { loadCatalogData } from '../catalog';
import type { CatalogData, CatalogItem } from '../catalog/catalog.schema';
import type { InventoryModifier } from '../common/inventory/inventory-modifier';
import type { DashboardStateResponse } from '../dashboard/dto/dashboard-state-response.dto';
import { DashboardService } from '../dashboard/dashboard.service';
import type { InventoryResponse } from '../inventory/dto/inventory-response.dto';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeValidationError } from '../common/validation/runtime-validation';
import type {
  EmbeddingPreviewEffect,
  EmbeddingPreviewEquipmentItem,
  EmbeddingPreviewModifier,
  EmbeddingPreviewOverview,
  EmbeddingPreviewPayload,
  EmbeddingPreviewSlot,
  EmbeddingPreviewStatBlock,
  EmbeddingPreviewStatSummary,
} from './dto/embedding-preview-response.dto';
import type { EmbeddingPreviewQueryDto } from './dto/embedding-preview-request.dto';
import { EmbedRendererService } from './embed-renderer.service';
import { assertEmbeddingPreviewPayload } from './validators/embedding-preview.validator';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly inventoryService: InventoryService,
    private readonly embedRendererService: EmbedRendererService,
  ) {}

  async getPreview(
    query: EmbeddingPreviewQueryDto,
  ): Promise<EmbeddingPreviewPayload> {
    const theme = query.theme ?? 'dark';
    const size = query.size ?? 'wide';
    const language = query.language ?? 'ko';
    const userId = query.userId;

    const [dashboard, inventory, user, catalog] = await Promise.all([
      this.dashboardService.getState(userId),
      this.inventoryService.getInventory(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, image: true },
      }),
      this.loadCatalog(language),
    ]);

    const overview = this.buildOverview({
      dashboard,
      inventory,
      catalog,
      displayName: user?.name ?? null,
      avatarUrl: user?.image ?? null,
    });

    const payload: EmbeddingPreviewPayload = {
      theme,
      size,
      language,
      generatedAt: new Date().toISOString(),
      overview,
    };

    try {
      return assertEmbeddingPreviewPayload(payload);
    } catch (error) {
      if (error instanceof RuntimeValidationError) {
        this.logger.error(
          'EmbeddingPreviewPayload validation failed',
          JSON.stringify({
            path: error.path,
            expected: error.expected,
            value: error.value,
            userId,
          }),
        );

        throw new InternalServerErrorException({
          code: 'EMBEDDING_PREVIEW_INVALID_RESPONSE',
          message: '임베딩 프리뷰 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
          },
        });
      }

      throw error;
    }
  }

  async getPreviewSvg(query: EmbeddingPreviewQueryDto): Promise<string> {
    const preview = await this.getPreview(query);
    return this.embedRendererService.renderPreviewSvg(preview);
  }

  private async loadCatalog(
    language: EmbeddingPreviewQueryDto['language'],
  ): Promise<CatalogData> {
    const locale = language === 'ko' ? 'ko' : 'en';
    return loadCatalogData(undefined, undefined, {
      locale,
      includeStrings: true,
    });
  }

  private buildOverview(params: {
    dashboard: DashboardStateResponse;
    inventory: InventoryResponse;
    catalog: CatalogData;
    displayName: string | null;
    avatarUrl: string | null;
  }): EmbeddingPreviewOverview {
    const { dashboard, inventory, catalog, displayName, avatarUrl } = params;
    const state = dashboard.state;
    const stats = this.buildStatSummary(state);
    const expToLevel = state.expToLevel ?? Math.max(0, state.level * 10);

    return {
      displayName,
      avatarUrl,
      level: state.level,
      exp: state.exp,
      expToLevel,
      gold: state.gold,
      ap: state.ap,
      maxAp: null,
      floor: {
        current: state.floor,
        best: state.maxFloor,
        progress: state.floorProgress,
      },
      stats,
      equipment: this.buildEquipment(inventory, catalog),
    };
  }

  private buildStatSummary(
    state: DashboardStateResponse['state'],
  ): EmbeddingPreviewStatSummary {
    const equipmentBonus = {
      hp: state.stats.equipmentBonus.hp,
      maxHp: state.stats.equipmentBonus.maxHp,
      atk: state.stats.equipmentBonus.atk,
      def: state.stats.equipmentBonus.def,
      luck: state.stats.equipmentBonus.luck,
      ap: 0,
    };
    const total: EmbeddingPreviewStatBlock = {
      hp: state.hp,
      maxHp: state.maxHp,
      atk: state.atk,
      def: state.def,
      luck: state.luck,
      ap: state.ap,
    };
    const base = this.calculateBaseStats(total, equipmentBonus);

    return {
      total,
      base,
      equipmentBonus,
    };
  }

  private calculateBaseStats(
    total: EmbeddingPreviewStatBlock,
    bonus: EmbeddingPreviewStatBlock,
  ): EmbeddingPreviewStatBlock {
    return {
      hp: this.clampStat(total.hp - bonus.hp, total.hp),
      maxHp: this.clampStat(total.maxHp - bonus.maxHp, total.maxHp),
      atk: this.clampStat(total.atk - bonus.atk, total.atk),
      def: this.clampStat(total.def - bonus.def, total.def),
      luck: this.clampStat(total.luck - bonus.luck, total.luck),
      ap: this.clampStat(total.ap - bonus.ap, total.ap),
    };
  }

  private clampStat(value: number, total: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(total)) {
      return 0;
    }
    return Math.max(0, Math.min(value, total));
  }

  private buildEquipment(
    inventory: InventoryResponse,
    catalog: CatalogData,
  ): EmbeddingPreviewEquipmentItem[] {
    const catalogMap = new Map(catalog.items.map((item) => [item.code, item]));

    return Object.values(inventory.equipped)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter(
        (
          item,
        ): item is InventoryResponse['items'][number] & {
          slot: EmbeddingPreviewSlot;
        } => this.isEmbeddingSlot(item.slot),
      )
      .map((item) => this.mapEquipmentItem(item, catalogMap, catalog));
  }

  private mapEquipmentItem(
    item: InventoryResponse['items'][number] & { slot: EmbeddingPreviewSlot },
    catalogMap: Map<string, CatalogItem>,
    catalog: CatalogData,
  ): EmbeddingPreviewEquipmentItem {
    const catalogItem = catalogMap.get(item.code);
    const name = catalogItem?.name ?? item.name ?? item.code;
    const spriteKey = this.resolveSpriteKey(item, catalogItem);
    const sprite = this.resolveSprite(spriteKey, catalog);
    const effect = this.resolveEffect(catalogItem);

    return {
      id: item.id,
      code: item.code ?? null,
      name,
      slot: item.slot,
      rarity: item.rarity,
      modifiers: this.resolveModifiers(item.modifiers),
      effect,
      sprite,
      createdAt: item.createdAt,
      isEquipped: item.isEquipped,
    };
  }

  private resolveSpriteKey(
    item: InventoryResponse['items'][number],
    catalogItem?: CatalogItem,
  ): string {
    const candidate = item.sprite ?? catalogItem?.spriteId ?? item.code;
    return candidate ?? item.code;
  }

  private resolveSprite(spriteKey: string, catalog: CatalogData): string {
    if (this.isRenderableUrl(spriteKey)) {
      return spriteKey;
    }

    const mapped = catalog.spriteMap?.[spriteKey];
    if (mapped) {
      return mapped;
    }

    const base = catalog.assetsBaseUrl;
    if (base) {
      const normalized = base.endsWith('/') ? base : `${base}/`;
      return `${normalized}${spriteKey}`;
    }

    return spriteKey;
  }

  private resolveModifiers(
    modifiers: InventoryModifier[],
  ): EmbeddingPreviewModifier[] {
    return modifiers.flatMap((modifier) => {
      if (modifier.kind !== 'stat') {
        return [];
      }
      if (modifier.mode !== 'flat') {
        return [];
      }

      return [
        {
          stat: modifier.stat,
          value: modifier.value,
        },
      ];
    });
  }

  private resolveEffect(
    catalogItem?: CatalogItem,
  ): EmbeddingPreviewEffect | null {
    const effectCode = catalogItem?.effectCode;
    if (!effectCode) {
      return null;
    }

    return {
      type: effectCode,
      description: catalogItem?.description ?? effectCode,
    };
  }

  private isRenderableUrl(value: string): boolean {
    return (
      value.startsWith('data:') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/')
    );
  }

  private isEmbeddingSlot(
    slot: InventoryResponse['items'][number]['slot'],
  ): slot is EmbeddingPreviewSlot {
    return slot !== 'consumable';
  }
}
