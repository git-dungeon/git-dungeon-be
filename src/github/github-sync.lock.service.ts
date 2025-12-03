import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { loadEnvironment } from '../config/environment';

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 100;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class GithubSyncLockService {
  private readonly logger = new Logger(GithubSyncLockService.name);
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly redisUrl: string;
  private readonly skipConnection: boolean;
  private connection?: IORedis;
  private readonly lockValues = new Map<string, string>();

  constructor(@Optional() private readonly configService?: ConfigService) {
    const env = configService ? undefined : loadEnvironment();
    const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

    this.lockTimeoutMs =
      this.configService?.get<number>('github.sync.lockTimeoutMs') ??
      DEFAULT_LOCK_TIMEOUT_MS;
    this.lockRetryDelayMs =
      this.configService?.get<number>('github.sync.lockRetryDelayMs') ??
      DEFAULT_LOCK_RETRY_DELAY_MS;

    this.redisUrl =
      this.configService?.get<string>('REDIS_URL') ??
      env?.redisUrl ??
      'redis://localhost:6379';
    this.skipConnection =
      this.configService?.get<boolean>('REDIS_SKIP_CONNECTION') ??
      env?.redisSkipConnection ??
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
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.lockTimeoutMs) {
      const acquired = await client.set(
        key,
        value,
        'PX',
        this.lockTimeoutMs,
        'NX',
      );
      if (acquired === 'OK') {
        this.lockValues.set(key, value);
        return true;
      }
      await sleep(this.lockRetryDelayMs);
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
        'Failed to release Redis lock',
      );
    } finally {
      this.lockValues.delete(key);
    }
  }

  private buildKey(userId: string): string {
    return `github:lock:user:${userId}`;
  }
}
