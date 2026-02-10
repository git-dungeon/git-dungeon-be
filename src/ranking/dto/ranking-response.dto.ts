export interface RankingEntry {
  rank: number;
  displayName?: string | null;
  avatarUrl?: string | null;
  level: number;
  maxFloor: number;
}

export interface RankingPayload {
  rankings: RankingEntry[];
  nextCursor: string | null;
}
