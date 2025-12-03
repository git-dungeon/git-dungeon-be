import { Prisma } from '@prisma/client';
import type { GithubRateLimit, GithubTokenType } from './github.interfaces';

export const extractContributionsFromCollection = (
  collection:
    | {
        totalCommitContributions?: number;
        restrictedContributionsCount?: number;
        pullRequestContributions?: { totalCount?: number };
        pullRequestReviewContributions?: { totalCount?: number };
        issueContributions?: { totalCount?: number };
      }
    | undefined,
): number => {
  if (!collection) return 0;

  const commits = collection.totalCommitContributions ?? 0;
  const restricted = collection.restrictedContributionsCount ?? 0;
  const prs = collection.pullRequestContributions?.totalCount ?? 0;
  const reviews = collection.pullRequestReviewContributions?.totalCount ?? 0;
  const issues = collection.issueContributions?.totalCount ?? 0;

  return commits + prs + reviews + issues + restricted;
};

export const getAnchorFromMeta = (
  meta: Prisma.JsonValue | null | undefined,
): Date | null => {
  if (!meta || typeof meta !== 'object') return null;
  const anchor = (meta as Record<string, unknown>).anchorFrom;
  if (typeof anchor !== 'string') return null;
  const date = new Date(anchor);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getLastContributionsTotal = (
  meta: Prisma.JsonValue | null | undefined,
  anchorFrom?: Date | null,
): number => {
  if (!meta || typeof meta !== 'object') return 0;
  const metaObj = meta as Record<string, unknown>;
  const totals = metaObj.totals as { contributions?: unknown } | undefined;
  const value = totals?.contributions;
  const total = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  // 앵커가 다르더라도 직전 총합이 있다면 우선 활용한다(앵커 재설정 시 중복 적재 방지).
  if (!anchorFrom) return total;
  const anchor = getAnchorFromMeta(meta as Prisma.JsonValue);
  if (!anchor) return total;
  return anchor.getTime() === anchorFrom.getTime() ? total : total;
};

export const buildRateLimitMeta = (
  rateLimit: GithubRateLimit | undefined,
): {
  remaining: number | null;
  resetAt: number | null;
  resource: string | null;
} | null => {
  if (!rateLimit) return null;
  return {
    remaining:
      typeof rateLimit.remaining === 'number' ? rateLimit.remaining : null,
    resetAt:
      typeof rateLimit.resetAt === 'number'
        ? rateLimit.resetAt
        : rateLimit.resetAt
          ? Number(new Date(rateLimit.resetAt).getTime())
          : null,
    resource:
      typeof rateLimit.resource === 'string' ? rateLimit.resource : null,
  };
};

export const buildMetaWithTotals = (
  rateLimit: GithubRateLimit | undefined,
  contributionsTotal: number,
  anchorFrom: Date,
  extras?: {
    tokensTried?: GithubTokenType[];
    attempts?: number;
    backoffMs?: number | null;
  },
): {
  rateLimit: {
    remaining: number | null;
    resetAt: number | null;
    resource: string | null;
  } | null;
  totals: { contributions: number };
  anchorFrom: string;
  tokensTried?: GithubTokenType[];
  attempts?: number;
  backoffMs?: number | null;
} => ({
  rateLimit: buildRateLimitMeta(rateLimit),
  totals: { contributions: contributionsTotal },
  anchorFrom: anchorFrom.toISOString(),
  tokensTried: extras?.tokensTried,
  attempts: extras?.attempts,
  backoffMs: extras?.backoffMs ?? null,
});
