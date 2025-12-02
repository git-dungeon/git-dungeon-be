import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 100;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class GithubSyncLockService {
  private readonly logger = new Logger(GithubSyncLockService.name);
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.lockTimeoutMs =
      this.configService?.get<number>('github.sync.lockTimeoutMs') ??
      DEFAULT_LOCK_TIMEOUT_MS;
    this.lockRetryDelayMs =
      this.configService?.get<number>('github.sync.lockRetryDelayMs') ??
      DEFAULT_LOCK_RETRY_DELAY_MS;
  }

  async acquire(userId: string): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.lockTimeoutMs) {
      const locked = await this.tryLock(userId);
      if (locked) return true;
      await sleep(this.lockRetryDelayMs);
    }

    return false;
  }

  async release(userId: string): Promise<void> {
    try {
      await this.prisma.$queryRaw<{ released: boolean }[]>`
        SELECT pg_advisory_unlock(hashtext(${userId})::bigint) as released
      `;
    } catch (error) {
      this.logger.warn(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to release advisory lock',
      );
    }
  }

  private async tryLock(userId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<{ locked?: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${userId})::bigint) as locked
    `;

    return result?.[0]?.locked === true;
  }
}
