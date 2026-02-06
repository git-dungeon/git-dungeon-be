export type GithubSyncTokenType = 'oauth' | 'pat';

export interface GithubSyncMetaDto {
  remaining: number | null;
  resetAt: number | null;
  resource: string | null;
}

export interface GithubSyncDataDto {
  contributions: number;
  windowStart: string;
  windowEnd: string;
  tokenType: GithubSyncTokenType;
  rateLimitRemaining?: number | null;
  logId: string;
  meta?: GithubSyncMetaDto;
}

export interface GithubSyncStatusDto {
  connected: boolean;
  allowed: boolean;
  cooldownMs: number;
  lastSyncAt: string | null;
  nextAvailableAt: string | null;
  retryAfterMs: number | null;
  lastManualSyncAt: string | null;
}
