import { Injectable } from '@nestjs/common';
import {
  ApSyncLog,
  ApSyncStatus,
  ApSyncTokenType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncApParams {
  userId: string;
  contributions: number;
  windowStart: Date;
  windowEnd: Date;
  tokenType: ApSyncTokenType;
  rateLimitRemaining?: number;
  cursor?: string | null;
  meta?: Prisma.JsonValue;
}

@Injectable()
export class GithubSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async applyContributionSync(
    params: SyncApParams,
  ): Promise<{ apDelta: number; log: ApSyncLog }> {
    const apDelta = params.contributions;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.apSyncLog.findUnique({
        where: {
          userId_windowStart_windowEnd: {
            userId: params.userId,
            windowStart: params.windowStart,
            windowEnd: params.windowEnd,
          },
        },
      });

      // 이미 성공 처리된 윈도우라면 중복 적재 방지
      if (existing?.status === ApSyncStatus.SUCCESS) {
        return { apDelta: existing.apDelta, log: existing };
      }

      // AP 적재
      if (apDelta !== 0) {
        await tx.dungeonState.update({
          where: { userId: params.userId },
          data: { ap: { increment: apDelta } },
        });
      }

      // lastSyncAt 대체: GitHub 계정 updatedAt을 갱신
      await tx.account.updateMany({
        where: { userId: params.userId, providerId: 'github' },
        data: { updatedAt: new Date() },
      });

      const upsertData: Prisma.ApSyncLogUncheckedCreateInput = {
        userId: params.userId,
        windowStart: params.windowStart,
        windowEnd: params.windowEnd,
        contributions: params.contributions,
        apDelta,
        tokenType: params.tokenType,
        rateLimitRemaining: params.rateLimitRemaining,
        cursor: params.cursor ?? null,
        meta: params.meta ?? Prisma.DbNull,
        status: ApSyncStatus.SUCCESS,
        errorCode: null,
      };

      const log = existing
        ? await tx.apSyncLog.update({
            where: { id: existing.id },
            data: upsertData,
          })
        : await tx.apSyncLog.create({ data: upsertData });

      return { apDelta, log };
    });
  }
}
