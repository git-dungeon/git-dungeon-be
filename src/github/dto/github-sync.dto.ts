import { tags } from 'typia';

export type GithubSyncTokenType = 'oauth' | 'pat';

export interface GithubSyncMetaDto {
  remaining: number | null;
  resetAt: number | null;
  resource: (string & tags.MinLength<1>) | null;
}

export interface GithubSyncDataDto {
  contributions: number & tags.Minimum<0>;
  windowStart: string & tags.Format<'date-time'>;
  windowEnd: string & tags.Format<'date-time'>;
  tokenType: GithubSyncTokenType;
  rateLimitRemaining?: number | null;
  logId: string & tags.Format<'uuid'>;
  meta?: GithubSyncMetaDto;
}

export interface GithubSyncStatusDto {
  connected: boolean;
  allowed: boolean;
  cooldownMs: number & tags.Minimum<0>;
  lastSyncAt: (string & tags.Format<'date-time'>) | null;
  nextAvailableAt: (string & tags.Format<'date-time'>) | null;
  retryAfterMs: (number & tags.Minimum<0>) | null;
}
