#!/usr/bin/env ts-node
import { SimulationRunner } from '../src/simulation/sim-runner';
import { listFixtureNames, getFixture } from '../src/simulation/fixtures';

const runner = new SimulationRunner(false); // dry-run only

async function main() {
  const names = listFixtureNames();
  for (const name of names) {
    const fixture = getFixture(name);
    if (!fixture) continue;
    const result = await runner.run(
      {
        userId: fixture.initialState.userId,
        seed: fixture.seed,
        maxActions: fixture.results.length,
        dryRun: true,
        initialState: fixture.initialState,
        fixtureName: name,
      },
      { name, snapshot: fixture },
    );

    console.log(`\n=== ${name} ===`);
    console.log(
      `actions ${result.summary.actionsCompleted}/${result.summary.actionsAttempted}, apConsumed=${result.summary.apConsumed}, final v${result.summary.finalVersion}, floor=${result.summary.finalFloor}, progress=${result.summary.finalProgress}`,
    );
    if (result.fixtureCheck) {
      console.log(
        `fixture check: ${result.fixtureCheck.passed ? 'PASS' : 'FAIL'}`,
      );
      result.fixtureCheck.mismatches.forEach((m) => console.log(`  - ${m}`));
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
