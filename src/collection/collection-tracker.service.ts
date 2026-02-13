import { Injectable, Logger } from '@nestjs/common';
import {
  DungeonLogAction,
  DungeonLogStatus,
  Prisma,
  UserCollectionTargetType,
} from '@prisma/client';
import { loadCatalogData } from '../catalog';
import { PrismaService } from '../prisma/prisma.service';

type PrismaClient = PrismaService | Prisma.TransactionClient;

type CollectionCatalogCodeSets = {
  items: Set<string>;
  monsters: Set<string>;
};

export type CollectionLogInput = {
  action: DungeonLogAction;
  status: DungeonLogStatus;
  delta?: unknown;
  extra?: unknown;
  createdAt?: Date | string | null;
};

export type CollectionDiscovery = {
  targetType: UserCollectionTargetType;
  targetCode: string;
  firstDiscoveredAt: Date;
};

@Injectable()
export class CollectionTrackerService {
  private readonly logger = new Logger(CollectionTrackerService.name);
  private catalogCodesPromise?: Promise<CollectionCatalogCodeSets>;

  constructor(private readonly prisma: PrismaService) {}

  extractDiscoveriesFromLog(log: CollectionLogInput): CollectionDiscovery[] {
    const discoveries: CollectionDiscovery[] = [];
    const discoveredAt = this.resolveDiscoveredAt(log.createdAt);

    if (
      log.action === DungeonLogAction.BATTLE &&
      (log.status === DungeonLogStatus.STARTED ||
        log.status === DungeonLogStatus.COMPLETED)
    ) {
      const monsterCode = this.readNestedString(log.extra, [
        'details',
        'monster',
        'code',
      ]);
      if (monsterCode) {
        discoveries.push({
          targetType: UserCollectionTargetType.MONSTER,
          targetCode: monsterCode,
          firstDiscoveredAt: discoveredAt,
        });
      } else {
        this.logger.warn(
          `collection: invalid monster code in BATTLE log (status=${log.status})`,
        );
      }
    }

    if (
      log.action === DungeonLogAction.ACQUIRE_ITEM ||
      log.action === DungeonLogAction.DISMANTLE_ITEM
    ) {
      const addedItems = this.readNestedArray(log.delta, [
        'detail',
        'inventory',
        'added',
      ]);

      for (let index = 0; index < addedItems.length; index += 1) {
        const rawCode = this.readNestedString(addedItems[index], ['code']);
        if (!rawCode) {
          this.logger.warn(
            `collection: invalid item code in ${log.action} log (addedIndex=${index})`,
          );
          continue;
        }

        discoveries.push({
          targetType: UserCollectionTargetType.ITEM,
          targetCode: rawCode,
          firstDiscoveredAt: discoveredAt,
        });
      }
    }

    return this.mergeDiscoveries(discoveries);
  }

  extractDiscoveriesFromLogs(logs: CollectionLogInput[]): CollectionDiscovery[] {
    const all = logs.flatMap((log) => this.extractDiscoveriesFromLog(log));
    return this.mergeDiscoveries(all);
  }

  async upsertDiscoveries(
    userId: string,
    discoveries: CollectionDiscovery[],
    prismaClient: PrismaClient = this.prisma,
  ): Promise<number> {
    const merged = this.mergeDiscoveries(discoveries);
    if (merged.length === 0) {
      return 0;
    }

    const catalogCodes = await this.getCatalogCodes();
    const validDiscoveries = merged.filter((discovery) => {
      const exists =
        discovery.targetType === UserCollectionTargetType.ITEM
          ? catalogCodes.items.has(discovery.targetCode)
          : catalogCodes.monsters.has(discovery.targetCode);

      if (!exists) {
        this.logger.warn(
          `collection: skip unknown catalog code type=${discovery.targetType} code=${discovery.targetCode}`,
        );
      }

      return exists;
    });

    await Promise.all(
      validDiscoveries.map((discovery) =>
        prismaClient.userCollectionEntry.upsert({
          where: {
            userId_targetType_targetCode: {
              userId,
              targetType: discovery.targetType,
              targetCode: discovery.targetCode,
            },
          },
          create: {
            userId,
            targetType: discovery.targetType,
            targetCode: discovery.targetCode,
            firstDiscoveredAt: discovery.firstDiscoveredAt,
          },
          update: {},
        }),
      ),
    );

    return validDiscoveries.length;
  }

  async recordFromLog(
    userId: string,
    log: CollectionLogInput,
    prismaClient: PrismaClient = this.prisma,
  ): Promise<number> {
    const discoveries = this.extractDiscoveriesFromLog(log);
    return this.upsertDiscoveries(userId, discoveries, prismaClient);
  }

  async recordFromLogs(
    userId: string,
    logs: CollectionLogInput[],
    prismaClient: PrismaClient = this.prisma,
  ): Promise<number> {
    const discoveries = this.extractDiscoveriesFromLogs(logs);
    return this.upsertDiscoveries(userId, discoveries, prismaClient);
  }

  private resolveDiscoveredAt(value: Date | string | null | undefined): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }

  private readNestedString(
    input: unknown,
    path: string[],
  ): string | undefined {
    const value = this.readNestedValue(input, path);
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private readNestedArray(input: unknown, path: string[]): unknown[] {
    const value = this.readNestedValue(input, path);
    return Array.isArray(value) ? value : [];
  }

  private readNestedValue(input: unknown, path: string[]): unknown {
    let current: unknown = input;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private mergeDiscoveries(discoveries: CollectionDiscovery[]): CollectionDiscovery[] {
    const merged = new Map<string, CollectionDiscovery>();

    for (const discovery of discoveries) {
      const key = `${discovery.targetType}:${discovery.targetCode}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, discovery);
        continue;
      }

      if (discovery.firstDiscoveredAt < existing.firstDiscoveredAt) {
        merged.set(key, discovery);
      }
    }

    return [...merged.values()];
  }

  private async getCatalogCodes(): Promise<CollectionCatalogCodeSets> {
    if (!this.catalogCodesPromise) {
      this.catalogCodesPromise = loadCatalogData().then((catalog) => ({
        items: new Set(catalog.items.map((item) => item.code)),
        monsters: new Set(catalog.monsters.map((monster) => monster.code)),
      }));
    }

    return this.catalogCodesPromise;
  }
}
