import { Injectable } from '@nestjs/common';
import { DungeonLogAction, DungeonLogCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encodeLogsCursor } from './logs-cursor.util';
import type { ValidatedLogsQuery } from './logs-query.validator';
import type { DungeonLogDelta } from '../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../common/logs/dungeon-log-extra';
import type { DungeonLogsPayload } from './dto/logs.response';
import { isLogAction, type LogAction, type LogStatus } from './logs.types';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(
    params: { userId: string } & ValidatedLogsQuery,
  ): Promise<DungeonLogsPayload> {
    const where: Prisma.DungeonLogWhereInput = {
      userId: params.userId,
    };

    if (params.type) {
      const isAction = isLogAction(params.type);
      if (isAction) {
        where.action = params.type as DungeonLogAction;
      } else {
        where.category = params.type as DungeonLogCategory;
      }
    }

    if (params.cursorPayload) {
      where.sequence = { lt: params.cursorPayload.sequence };
    }

    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      };
    }

    const logs = await this.prisma.dungeonLog.findMany({
      where,
      orderBy: [{ sequence: Prisma.SortOrder.desc }],
      take: params.limit + 1,
    });

    const hasNext = logs.length > params.limit;
    const visibleLogs = hasNext ? logs.slice(0, params.limit) : logs;
    const nextCursor =
      hasNext && visibleLogs.length > 0
        ? encodeLogsCursor({
            sequence: visibleLogs[visibleLogs.length - 1].sequence,
          })
        : null;

    return {
      logs: visibleLogs.map((log) => ({
        id: log.id,
        category: log.category,
        action: log.action as LogAction,
        status: log.status as LogStatus,
        floor: log.floor,
        turnNumber: log.turnNumber,
        stateVersionBefore: log.stateVersionBefore,
        stateVersionAfter: log.stateVersionAfter,
        delta: (log.delta as DungeonLogDelta | null) ?? null,
        extra: (log.extra as DungeonLogDetails | null) ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
