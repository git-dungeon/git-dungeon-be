import { describe, expect, it } from 'vitest';
import { SimulationRunner } from '../../simulation/sim-runner';
import { FixtureRegistry } from '../../test-support/dungeon/fixtures/registry';
import { normalizeResult } from '../../test-support/snapshot/normalizers';
// fixture 모듈 import 시 registry에 자동 등록됨
import '../../test-support/dungeon/fixtures';

const runner = new SimulationRunner(false); // dry-run (no DB)

// Registry에서 대표 fixture만 추려 스냅샷 테스트 생성
const snapshotFixtureNames = new Set([
  'baseline',
  'trap-death',
  'forced-move',
  'turn-limit',
  'elite-battle',
]);
const allFixtures = FixtureRegistry.listAll();
const fixtures = allFixtures.filter((fixture) =>
  snapshotFixtureNames.has(fixture.meta.name),
);

describe('simulation fixtures snapshots', () => {
  it('has fixtures registered', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    const names = fixtures.map((f) => f.meta.name);
    expect(names).toContain('baseline');
    expect(names).toContain('trap-death');
    expect(names).toContain('forced-move');
  });

  fixtures.forEach((fixture) => {
    const { name, description, tags } = fixture.meta;

    it(`[${name}] matches snapshot (${description})`, async () => {
      // baseline은 3개 액션, 나머지는 1개 액션
      const maxActions = name === 'baseline' ? 3 : 1;

      const result = await runner.run(
        {
          userId: fixture.initialState.userId,
          seed: fixture.seed,
          maxActions,
          dryRun: true,
          initialState: fixture.initialState,
          fixtureName: name,
        },
        {
          name,
          snapshot: FixtureRegistry.toLegacySnapshot(name)!,
        },
      );

      // 핵심 필드 검증: progress/HP delta 존재 여부 (MOVE는 예외)
      result.steps.forEach((step) => {
        if (String(step.selectedEvent) !== 'MOVE') {
          const hasProgress = step.logs.some((l) => {
            const delta = l.delta as
              | {
                  detail?: {
                    progress?: unknown;
                    stats?: { hp?: unknown };
                  };
                }
              | null
              | undefined;
            return (
              delta?.detail?.progress !== undefined ||
              delta?.detail?.stats?.hp !== undefined
            );
          });
          expect(hasProgress).toBe(true);
        }
      });

      // 태그 기반 추가 검증
      if (tags?.includes('drop')) {
        const hasChests = result.steps.flatMap((s) => s.logs).some((log) => {
          const delta = log.delta as
            | {
                detail?: {
                  rewards?: { chests?: number };
                };
              }
            | null
            | undefined;
          return (delta?.detail?.rewards?.chests ?? 0) > 0;
        });
        expect(hasChests, `${name} should have chest rewards`).toBe(true);
      }

      if (tags?.includes('death')) {
        const death = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'DEATH' && l.status === 'COMPLETED');
        expect(death, `${name} should have DEATH log`).toBeDefined();
      }

      // 특수 케이스별 검증
      if (name === 'turn-limit') {
        const battle = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'BATTLE' && l.status === 'COMPLETED');
        const battleExtra = battle?.extra as { details?: { cause?: unknown } };
        expect(battleExtra?.details?.cause).toBe('TURN_LIMIT');
      }

      if (name === 'trap-death') {
        const death = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'DEATH' && l.status === 'COMPLETED');
        const deathExtra = death?.extra as { details?: { cause?: unknown } };
        expect(deathExtra?.details?.cause).toBe('TRAP_DAMAGE');
      }

      if (name === 'forced-move') {
        const moveCompleted = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'MOVE' && l.status === 'COMPLETED');
        expect(moveCompleted?.floor).toBe(fixture.initialState.floor + 1);
      }

      const normalized = normalizeResult(result);
      expect(normalized).toMatchSnapshot();
    });
  });
});
