import type { DungeonState } from '@prisma/client';
import type { DungeonEventType } from '../../../dungeon/events/event.types';

/**
 * 스냅샷 기준
 * - pre: 실행 전 입력(초기 상태/seed) 기준
 * - post: 실행 결과(steps/logs/summary) 기준
 */
export type SnapshotPhase = 'pre' | 'post';

/**
 * Fixture 메타데이터
 */
export interface FixtureMeta {
  /** fixture 이름 (고유) */
  name: string;
  /** 설명 */
  description: string;
  /** 스냅샷 기준 */
  snapshotPhase: SnapshotPhase;
  /** 태그 (선택) */
  tags?: string[];
}

/**
 * 스냅샷 스텝 (시뮬레이션 결과)
 */
export type SnapshotStep = {
  actionCounter: number;
  selectedEvent:
    | DungeonEventType
    | 'TREASURE'
    | 'REST'
    | 'BATTLE'
    | 'TRAP'
    | 'MOVE';
  stateAfter: Pick<
    DungeonState,
    'hp' | 'ap' | 'floor' | 'floorProgress' | 'level' | 'exp' | 'version'
  >;
  extra: Array<{
    action: string;
    status: string;
    category?: string;
    floor?: number | null;
    turnNumber?: number | null;
    delta?: unknown;
    extra?: unknown;
  }>;
};

/**
 * Fixture 정의 (메타 + 데이터)
 */
export interface FixtureDefinition {
  meta: FixtureMeta;
  seed: string;
  initialState: DungeonState;
  steps: SnapshotStep[];
}

/**
 * 레거시 스냅샷 형식 (호환용)
 */
export interface LegacySnapshot {
  seed: string;
  initialState: DungeonState;
  results: SnapshotStep[];
}
