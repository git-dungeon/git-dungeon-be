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

type SyncStateTx = {
  githubSyncState: {
    upsert: (args: Prisma.GithubSyncStateUpsertArgs) => Promise<unknown>;
  };
};

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
    const lastSuccessfulSyncAt = params.windowEnd;
    let attempt = 0;
    const maxAttempts = 3;
    const baseDelayMs = 50;

    // 경합 시(P2002) 짧은 백오프 후 재시도
    while (true) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 동일 anchor(windowStart)로 최신 로그를 조회해 재활용한다.
          const anchorLog = await tx.apSyncLog.findFirst({
            where: { userId: params.userId, windowStart: params.windowStart },
            orderBy: { windowEnd: 'desc' },
          });

          // 동일 anchor로 이미 성공했고 추가 적재가 없으면 스킵
          if (anchorLog?.status === ApSyncStatus.SUCCESS && apDelta === 0) {
            await this.upsertSyncState(tx as unknown as SyncStateTx, {
              userId: params.userId,
              lastSuccessfulSyncAt,
            });
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
              await this.upsertSyncState(tx as unknown as SyncStateTx, {
                userId: params.userId,
                lastSuccessfulSyncAt,
              });
              return { apDelta: 0, log: existing };
            }
            await this.upsertSyncState(tx as unknown as SyncStateTx, {
              userId: params.userId,
              lastSuccessfulSyncAt,
            });
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

          await this.upsertSyncState(tx as unknown as SyncStateTx, {
            userId: params.userId,
            lastSuccessfulSyncAt,
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
      } catch (error) {
        const isUnique =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isUnique || attempt >= maxAttempts - 1) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)),
        );
        attempt += 1;
      }
    }
  }

  private async upsertSyncState(
    tx: SyncStateTx,
    params: { userId: string; lastSuccessfulSyncAt: Date },
  ): Promise<void> {
    await tx.githubSyncState.upsert({
      where: { userId: params.userId },
      update: { lastSuccessfulSyncAt: params.lastSuccessfulSyncAt },
      create: {
        userId: params.userId,
        lastSuccessfulSyncAt: params.lastSuccessfulSyncAt,
        lastManualSuccessfulSyncAt: null,
      },
    });
  }
}
