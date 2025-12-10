import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { loadEnvironment } from '../../config/environment';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class DungeonBatchLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DungeonBatchLockService.name);
  private readonly ttlMs: number;
  private readonly backoffMs: number;
  private readonly maxRetry: number;
  private readonly redisUrl: string;
  private readonly skipConnection: boolean;
  private readonly lockValues = new Map<string, string>();
  private connection?: IORedis;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

    this.ttlMs =
      this.configService?.get<number>('dungeon.batch.lockTtlMs') ??
      fallbackEnv?.dungeonBatchLockTtlMs ??
      60_000;
    this.backoffMs =
      this.configService?.get<number>('dungeon.batch.lockBackoffMs') ??
      fallbackEnv?.dungeonBatchLockBackoffMs ??
      200;
    this.maxRetry =
      this.configService?.get<number>('dungeon.batch.lockMaxRetry') ??
      fallbackEnv?.dungeonBatchLockMaxRetry ??
      3;

    this.redisUrl =
      this.configService?.get<string>('redis.url') ??
      fallbackEnv?.redisUrl ??
      'redis://localhost:6379';
    this.skipConnection =
      this.configService?.get<boolean>('redis.skipConnection') ??
      fallbackEnv?.redisSkipConnection ??
      nodeEnv === 'test';
  }

  private ensureClient(): IORedis | undefined {
    if (this.skipConnection) return undefined;
    if (this.connection) return this.connection;

    this.connection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    return this.connection;
  }

  async acquire(userId: string): Promise<boolean> {
    const client = this.ensureClient();
    if (!client) return true;

    const key = this.buildKey(userId);
    const value = randomUUID();

    for (let attempt = 0; attempt <= this.maxRetry; attempt += 1) {
      const acquired = await client.set(key, value, 'PX', this.ttlMs, 'NX');

      if (acquired === 'OK') {
        this.lockValues.set(key, value);
        return true;
      }

      if (attempt < this.maxRetry) {
        await sleep(this.backoffMs);
      }
    }

    return false;
  }

  async release(userId: string): Promise<void> {
    const client = this.ensureClient();
    if (!client) return;

    const key = this.buildKey(userId);
    const value = this.lockValues.get(key);
    if (!value) return;

    try {
      const releaseScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await client.eval(releaseScript, 1, key, value);
    } catch (error) {
      this.logger.warn(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to release dungeon batch lock',
      );
    } finally {
      this.lockValues.delete(key);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
    }
  }

  private buildKey(userId: string): string {
    return `dungeon:lock:${userId}`;
  }
}
