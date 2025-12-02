import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly initialAp: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.initialAp =
      this.configService?.get<number>('dungeon.initialAp', 10) ?? 10;
  }

  async applyContributionSync(
    params: SyncApParams,
  ): Promise<{ apDelta: number; log: ApSyncLog }> {
    const apDelta = params.contributions;

    return this.prisma.$transaction(async (tx) => {
      const lastSuccess = await tx.apSyncLog.findFirst({
        where: { userId: params.userId, status: ApSyncStatus.SUCCESS },
        orderBy: { windowEnd: 'desc' },
        select: {
          id: true,
          status: true,
          apDelta: true,
          windowStart: true,
          windowEnd: true,
        },
      });

      // 동일 anchor(windowStart)로 최신 로그를 조회해 재활용한다.
      const anchorLog = await tx.apSyncLog.findFirst({
        where: { userId: params.userId, windowStart: params.windowStart },
        orderBy: { windowEnd: 'desc' },
      });

      // 동일 anchor로 이미 성공했고 추가 적재가 없으면 스킵
      if (anchorLog?.status === ApSyncStatus.SUCCESS && apDelta === 0) {
        return { apDelta: 0, log: anchorLog };
      }

      const existing = await tx.apSyncLog.findUnique({
        where: {
          userId_windowStart_windowEnd: {
            userId: params.userId,
            windowStart: params.windowStart,
            windowEnd: params.windowEnd,
          },
        },
      });

      // 이미 동일 윈도우 성공 로그가 있으면 중복 적재를 방지한다.
      if (existing?.status === ApSyncStatus.SUCCESS) {
        if (apDelta <= 0) {
          return { apDelta: 0, log: existing };
        }
        return { apDelta: existing.apDelta, log: existing };
      }

      // AP 적재
      if (apDelta !== 0) {
        await tx.dungeonState.upsert({
          where: { userId: params.userId },
          update: { ap: { increment: apDelta } },
          create: {
            userId: params.userId,
            ap: this.initialAp + apDelta,
          },
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
        : anchorLog
          ? await tx.apSyncLog.update({
              where: { id: anchorLog.id },
              data: upsertData,
            })
          : await tx.apSyncLog.create({ data: upsertData });

      return { apDelta, log };
    });
  }
}
