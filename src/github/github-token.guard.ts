import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { createHash, randomUUID } from 'crypto';
import { GithubRateLimit, GithubTokenCandidate } from './github.interfaces';
import { loadEnvironment } from '../config/environment';

type SkipDecision = {
  skip: boolean;
  reason?: 'COOLDOWN' | 'RATE_LIMIT_CACHE';
  retryAt?: number;
  remaining?: number | null;
  resource?: string | null;
};

@Injectable()
export class GithubTokenGuard implements OnModuleDestroy {
  private readonly logger = new Logger(GithubTokenGuard.name);
  private readonly redisUrl: string;
  private readonly lockTtlMs: number;
  private readonly rateLimitCacheMs: number;
  private readonly cooldownMs: number;
  private readonly skipConnection: boolean;
  private connection?: IORedis;
  private readonly lockValues = new Map<string, string>();

  constructor(@Optional() private readonly configService?: ConfigService) {
    const env = configService ? undefined : loadEnvironment();
    const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

    this.redisUrl =
      this.configService?.get<string>('REDIS_URL') ??
      env?.redisUrl ??
      'redis://localhost:6379';
    this.lockTtlMs =
      this.configService?.get<number>('GITHUB_TOKEN_LOCK_TTL_MS') ??
      env?.githubTokenLockTtlMs ??
      30_000;
    this.rateLimitCacheMs =
      this.configService?.get<number>('GITHUB_TOKEN_RATE_LIMIT_CACHE_MS') ??
      env?.githubTokenRateLimitCacheMs ??
      5 * 60 * 1000;
    this.cooldownMs =
      this.configService?.get<number>('GITHUB_TOKEN_COOLDOWN_MS') ??
      env?.githubTokenCooldownMs ??
      15 * 60 * 1000;
    this.skipConnection =
      this.configService?.get<boolean>('REDIS_SKIP_CONNECTION') ??
      env?.redisSkipConnection ??
      nodeEnv === 'test';
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.quit();
  }

  async acquireLock(candidate: GithubTokenCandidate): Promise<boolean> {
    const client = this.ensureClient();
    if (!client) return true;

    const hash = this.hashToken(candidate.token);
    const key = this.buildLockKey(hash);
    const value = randomUUID();
    const acquired = await client.set(key, value, 'PX', this.lockTtlMs, 'NX');
    if (acquired === 'OK') {
      this.lockValues.set(key, value);
      return true;
    }

    return false;
  }

  async releaseLock(candidate: GithubTokenCandidate): Promise<void> {
    const client = this.ensureClient();
    if (!client) return;

    const hash = this.hashToken(candidate.token);
    const key = this.buildLockKey(hash);
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
    } finally {
      this.lockValues.delete(key);
    }
  }

  async shouldSkipToken(
    candidate: GithubTokenCandidate,
    threshold: number,
  ): Promise<SkipDecision> {
    const client = this.ensureClient();
    if (!client) return { skip: false };

    const hash = this.hashToken(candidate.token);
    const cooldownKey = this.buildCooldownKey(hash);
    const rateLimitKey = this.buildRateLimitKey(hash);

    const results = await client
      .multi()
      .pttl(cooldownKey)
      .get(rateLimitKey)
      .exec();

    const cooldownTtl = results?.[0]?.[1] as number | null;
    const rateLimitRaw = results?.[1]?.[1] as string | null;

    const now = Date.now();
    if (typeof cooldownTtl === 'number' && cooldownTtl > 0) {
      return {
        skip: true,
        reason: 'COOLDOWN',
        retryAt: now + cooldownTtl,
      };
    }

    let cached: (GithubRateLimit & { updatedAt?: number }) | null = null;
    if (rateLimitRaw) {
      try {
        cached = JSON.parse(rateLimitRaw) as GithubRateLimit & {
          updatedAt?: number;
        };
      } catch {
        cached = null;
      }
    }

    if (
      cached &&
      typeof cached.remaining === 'number' &&
      cached.remaining <= threshold
    ) {
      const retryAt =
        typeof cached.resetAt === 'number' && cached.resetAt > now
          ? cached.resetAt
          : now + this.rateLimitCacheMs;
      return {
        skip: true,
        reason: 'RATE_LIMIT_CACHE',
        retryAt,
        remaining: cached.remaining ?? null,
        resource: typeof cached.resource === 'string' ? cached.resource : null,
      };
    }

    return { skip: false };
  }

  async recordRateLimit(
    candidate: GithubTokenCandidate,
    rateLimit?: GithubRateLimit,
  ): Promise<void> {
    const client = this.ensureClient();
    if (!client || !rateLimit) return;

    const hash = this.hashToken(candidate.token);
    const rateLimitKey = this.buildRateLimitKey(hash);
    const ttl = this.computeRateLimitTtl(rateLimit);

    const payload = JSON.stringify({
      remaining:
        typeof rateLimit.remaining === 'number' ? rateLimit.remaining : null,
      resetAt: typeof rateLimit.resetAt === 'number' ? rateLimit.resetAt : null,
      resource:
        typeof rateLimit.resource === 'string' ? rateLimit.resource : null,
      updatedAt: Date.now(),
    });

    await client.set(rateLimitKey, payload, 'PX', Math.max(ttl, 1_000));
  }

  async markCooldown(
    candidate: GithubTokenCandidate,
    reason: string,
    ttlMs?: number,
  ): Promise<void> {
    const client = this.ensureClient();
    if (!client) return;

    const hash = this.hashToken(candidate.token);
    const cooldownKey = this.buildCooldownKey(hash);
    const ttl = Math.max(ttlMs ?? this.cooldownMs, 1_000);
    await client.set(cooldownKey, reason, 'PX', ttl);
    this.logger.warn({
      message: 'GitHub token cooldown applied',
      tokenType: candidate.type,
      fingerprint: this.fingerprint(hash),
      reason,
      ttlMs: ttl,
    });
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

  private computeRateLimitTtl(rateLimit: GithubRateLimit): number {
    if (rateLimit.resetAt && rateLimit.resetAt > Date.now()) {
      return rateLimit.resetAt - Date.now();
    }
    return this.rateLimitCacheMs;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private fingerprint(hash: string): string {
    return hash.slice(0, 8);
  }

  private buildLockKey(hash: string): string {
    return `github:token:${hash}:lock`;
  }

  private buildRateLimitKey(hash: string): string {
    return `github:token:${hash}:limit`;
  }

  private buildCooldownKey(hash: string): string {
    return `github:token:${hash}:cooldown`;
  }
}
