import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserCollectionTargetType } from '@prisma/client';
import { loadCatalogData } from '../catalog';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeValidationError } from '../common/validation/runtime-validation';
import type {
  CollectionProgress,
  CollectionResponse,
} from './dto/collection-response.dto';
import { assertCollectionResponse } from './validators/collection-response.validator';

type CollectionCatalogSnapshot = {
  itemCodes: Set<string>;
  monsterCodes: Set<string>;
  itemTotal: number;
  monsterTotal: number;
};

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);
  private catalogSnapshotPromise?: Promise<CollectionCatalogSnapshot>;

  constructor(private readonly prisma: PrismaService) {}

  async getCollection(userId: string): Promise<CollectionResponse> {
    const [catalog, discoveredItemRows, discoveredMonsterRows] =
      await Promise.all([
        this.getCatalogSnapshot(),
        this.prisma.userCollectionEntry.findMany({
          where: {
            userId,
            targetType: UserCollectionTargetType.ITEM,
          },
          select: { targetCode: true },
          orderBy: { targetCode: 'asc' },
        }),
        this.prisma.userCollectionEntry.findMany({
          where: {
            userId,
            targetType: UserCollectionTargetType.MONSTER,
          },
          select: { targetCode: true },
          orderBy: { targetCode: 'asc' },
        }),
      ]);

    const discoveredItemCodes = this.collectKnownCodes(
      discoveredItemRows.map((row) => row.targetCode),
      catalog.itemCodes,
    );
    const discoveredMonsterCodes = this.collectKnownCodes(
      discoveredMonsterRows.map((row) => row.targetCode),
      catalog.monsterCodes,
    );

    const itemProgress = this.calculateProgress(
      discoveredItemCodes.length,
      catalog.itemTotal,
    );
    const monsterProgress = this.calculateProgress(
      discoveredMonsterCodes.length,
      catalog.monsterTotal,
    );
    const overallDiscovered =
      discoveredItemCodes.length + discoveredMonsterCodes.length;
    const overallTotal = catalog.itemTotal + catalog.monsterTotal;
    const overallProgress = this.calculateProgress(overallDiscovered, overallTotal);

    const response: CollectionResponse = {
      summary: {
        items: itemProgress,
        monsters: monsterProgress,
        overall: overallProgress,
      },
      items: {
        discoveredCodes: discoveredItemCodes,
      },
      monsters: {
        discoveredCodes: discoveredMonsterCodes,
      },
    };

    try {
      return assertCollectionResponse(response);
    } catch (error) {
      if (error instanceof RuntimeValidationError) {
        this.logger.error(
          'CollectionResponse validation failed',
          JSON.stringify({
            path: error.path,
            expected: error.expected,
            value: error.value,
            userId,
          }),
        );

        throw new InternalServerErrorException({
          code: 'COLLECTION_INVALID_RESPONSE',
          message: '컬렉션 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
          },
        });
      }

      throw error;
    }
  }

  private collectKnownCodes(codes: string[], knownCodes: Set<string>): string[] {
    const discovered = new Set<string>();

    for (const code of codes) {
      if (knownCodes.has(code)) {
        discovered.add(code);
      }
    }

    return [...discovered].sort((a, b) => a.localeCompare(b));
  }

  private calculateProgress(discovered: number, total: number): CollectionProgress {
    return {
      discovered,
      total,
      percent: total === 0 ? 0 : Math.round((discovered / total) * 100),
    };
  }

  private async getCatalogSnapshot(): Promise<CollectionCatalogSnapshot> {
    if (!this.catalogSnapshotPromise) {
      this.catalogSnapshotPromise = loadCatalogData().then((catalog) => {
        const itemCodes = new Set(catalog.items.map((item) => item.code));
        const monsterCodes = new Set(
          catalog.monsters.map((monster) => monster.code),
        );

        return {
          itemCodes,
          monsterCodes,
          itemTotal: itemCodes.size,
          monsterTotal: monsterCodes.size,
        };
      });
    }

    return this.catalogSnapshotPromise;
  }
}
