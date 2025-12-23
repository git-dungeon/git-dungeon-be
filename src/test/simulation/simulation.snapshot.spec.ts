import { describe, expect, it } from 'vitest';
import { SimulationRunner } from '../../simulation/sim-runner';
import { getFixture, listFixtureNames } from '../../simulation/fixtures';
import { normalizeResult } from '../../test-support/snapshot/normalizers';

type Case = {
  name: string;
  maxActions: number;
};

const cases: Case[] = [
  { name: 'baseline', maxActions: 3 },
  { name: 'turn-limit', maxActions: 1 },
  { name: 'trap-death', maxActions: 1 },
  { name: 'no-drop', maxActions: 1 },
  { name: 'long-battle', maxActions: 1 },
  { name: 'forced-move', maxActions: 1 },
];

const runner = new SimulationRunner(false); // dry-run (no DB)

describe('simulation fixtures snapshots', () => {
  it('has all declared fixtures', () => {
    const available = listFixtureNames();
    cases.forEach((c) => {
      expect(available.includes(c.name), `fixture ${c.name} should exist`).toBe(
        true,
      );
    });
  });

  cases.forEach(({ name, maxActions }) => {
    it(`matches snapshot: ${name}`, async () => {
      const fixture = getFixture(name);
      expect(fixture, `fixture ${name} should be defined`).toBeDefined();
      if (!fixture) return;

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
          snapshot: fixture,
        },
      );

      // 핵심 필드 검증: progress/ACQUIRE_ITEM/원인 등
      result.steps.forEach((step) => {
        // progress delta 존재 여부 (MOVE는 예외)
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

      if (name === 'baseline') {
        const acquire = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'ACQUIRE_ITEM' && l.status === 'COMPLETED');
        expect(acquire).toBeDefined();
      }

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
        expect(death?.floor).toBe(1);

        const trapCompleted = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'TRAP' && l.status === 'COMPLETED');
        expect(trapCompleted?.floor).toBe(fixture.initialState.floor);
      }

      if (name === 'forced-move') {
        const battleCompleted = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'BATTLE' && l.status === 'COMPLETED');
        const moveCompleted = result.steps
          .flatMap((s) => s.logs)
          .find((l) => l.action === 'MOVE' && l.status === 'COMPLETED');

        expect(battleCompleted?.floor).toBe(fixture.initialState.floor);
        expect(moveCompleted?.floor).toBe(fixture.initialState.floor + 1);
      }

      const normalized = normalizeResult(result);
      expect(normalized).toMatchSnapshot();
    });
  });
});
