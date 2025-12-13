#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';
import { SimulationRunner } from '../src/simulation/sim-runner';
import { listFixtureNames, getFixture } from '../src/simulation/fixtures';
import type {
  SimulationResult,
  SimulationSnapshot,
} from '../src/simulation/types';

type Mode = 'full' | 'fast';
type Report = 'pretty' | 'json';

type Args = {
  mode: Mode;
  report: Report;
  out?: string;
  compare?: string;
  tolerance: number;
  strict: boolean;
};

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    mode: 'full',
    report: 'pretty',
    tolerance: 0.1,
    strict: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--mode':
        args.mode = (argv[++i] as Mode) ?? 'full';
        break;
      case '--report':
        args.report = (argv[++i] as Report) ?? 'pretty';
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--compare':
        args.compare = argv[++i];
        break;
      case '--tolerance':
        {
          const next = argv[i + 1];
          if (!next || next.startsWith('-')) {
            throw new Error(
              '--tolerance 옵션은 숫자 값을 필요로 합니다. 예: --tolerance 0.1',
            );
          }
          const parsed = Number(next);
          if (!Number.isFinite(parsed)) {
            throw new Error(
              `--tolerance 옵션 값이 올바른 숫자가 아닙니다: "${next}"`,
            );
          }
          args.tolerance = parsed;
          i += 1;
        }
        break;
      case '--strict':
        args.strict = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`알 수 없는 옵션: ${arg}`);
    }
  }

  return args;
};

const printHelp = () => {
  console.log(`Dungeon simulation all-runner

옵션:
  --mode <fast|full>   fast는 대표 fixture만 실행 (기본 full)
  --report <pretty|json> 출력 형식 (기본 pretty)
  --out <path>         report=json일 때 파일 저장 경로
  --compare <path>     baseline json과 비교 (없으면 건너뜀)
  --tolerance <n>      허용 오차 비율(0.1=10%, 기본 0.1)
  --strict             오차 초과 시 exit 1 (기본: 경고만)
  --help, -h           도움말
`);
};

const runner = new SimulationRunner(false); // dry-run only

type Aggregate = {
  fixtures: number;
  passed: number;
  failed: number;
  passRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  avgActionsCompleted: number;
  avgVictoryRate: number;
  avgTurns: number;
  avgExpGained: number;
  avgLevelUps: number;
  avgEliteDropRate: number;
  avgMsPerAp: number;
  avgApPerAction: number;
  details: Record<
    string,
    {
      passed: boolean;
      durationMs: number;
      actionsCompleted: number;
      mismatches: string[];
      metrics: FixtureMetrics;
    }
  >;
};

type FixtureMetrics = {
  victoryRate: number;
  avgTurns: number;
  expGained: number;
  levelUps: number;
  eliteDropRate: number;
  msPerAp: number;
  apPerAction: number;
};

type CompareResult = {
  found: boolean;
  tolerance: number;
  exceeded: boolean;
  messages: string[];
};

const p95 = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[idx];
};

const computeMetrics = (
  result: SimulationResult,
  fixture?: SimulationSnapshot,
): FixtureMetrics => {
  let battleCount = 0;
  let victoryCount = 0;
  let turnTotal = 0;
  let turnCount = 0;
  let expGained = 0;
  let eliteDrops = 0;
  let dropCount = 0;

  result.steps.forEach((step) => {
    step.logs.forEach((log) => {
      const extra = (log as { extra?: unknown }).extra as
        | { details?: Record<string, unknown> }
        | undefined;
      const details = extra?.details;

      const delta = (log as { delta?: unknown }).delta as
        | { detail?: { stats?: { exp?: unknown } } }
        | undefined;
      const deltaExp = delta?.detail?.stats?.exp;

      let detailsExp: number | undefined;
      if (log.action === 'BATTLE' && details) {
        battleCount += 1;
        const resultStr = (details.result as string | undefined) ?? '';
        if (resultStr === 'VICTORY') victoryCount += 1;
        const turns = details.turns as number | undefined;
        if (typeof turns === 'number' && Number.isFinite(turns)) {
          turnTotal += turns;
          turnCount += 1;
        }
        const exp = details.expGained as number | undefined;
        if (typeof exp === 'number' && Number.isFinite(exp)) {
          detailsExp = exp;
        }
      }

      if (log.action === 'ACQUIRE_ITEM' && details) {
        const reward = details.reward as
          | { drop?: { isElite?: boolean } }
          | undefined;
        const drop = reward?.drop;
        if (drop) {
          dropCount += 1;
          if (drop.isElite) eliteDrops += 1;
        }
      }

      const resolvedExp =
        typeof deltaExp === 'number' && Number.isFinite(deltaExp)
          ? deltaExp
          : detailsExp;
      if (typeof resolvedExp === 'number' && Number.isFinite(resolvedExp)) {
        expGained += resolvedExp;
      }
    });
  });

  const initialLevel =
    fixture?.initialState.level ?? result.steps[0]?.stateAfter.level ?? 0;
  const finalLevel = result.steps.at(-1)?.stateAfter.level ?? initialLevel;
  const levelUps = Math.max(0, finalLevel - initialLevel);

  const initialExp =
    fixture?.initialState.exp ?? result.steps[0]?.stateAfter.exp ?? 0;
  const finalExp = result.steps.at(-1)?.stateAfter.exp ?? initialExp;
  const expDelta = Math.max(0, finalExp - initialExp);
  expGained = expGained || expDelta;

  const victoryRate = battleCount ? victoryCount / battleCount : 0;
  const avgTurns = turnCount ? turnTotal / turnCount : 0;
  const eliteDropRate = dropCount ? eliteDrops / dropCount : 0;

  const msPerAp =
    result.summary.apConsumed > 0
      ? result.summary.durationMs / result.summary.apConsumed
      : 0;
  const apPerAction =
    result.summary.actionsCompleted > 0
      ? result.summary.apConsumed / result.summary.actionsCompleted
      : 0;

  return {
    victoryRate,
    avgTurns,
    expGained,
    levelUps,
    eliteDropRate,
    msPerAp,
    apPerAction,
  };
};

const aggregateResults = (
  results: Array<{
    name: string;
    result: SimulationResult;
    metrics: FixtureMetrics;
  }>,
): Aggregate => {
  const durations = results.map((r) => r.result.summary.durationMs);
  const actions = results.map((r) => r.result.summary.actionsCompleted);
  const passes = results.map((r) => r.result.fixtureCheck?.passed ?? true);
  const metricsList = results.map((r) => r.metrics);

  const details: Aggregate['details'] = {};
  results.forEach((entry) => {
    details[entry.name] = {
      passed: entry.result.fixtureCheck?.passed ?? true,
      durationMs: entry.result.summary.durationMs,
      actionsCompleted: entry.result.summary.actionsCompleted,
      mismatches: entry.result.fixtureCheck?.mismatches ?? [],
      metrics: entry.metrics,
    };
  });

  const passed = passes.filter(Boolean).length;
  const failed = passes.length - passed;
  const avgDurationMs = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const avgActions = actions.length
    ? actions.reduce((a, b) => a + b, 0) / actions.length
    : 0;

  const avgMetric = <K extends keyof FixtureMetrics>(key: K) =>
    metricsList.reduce((acc, m) => acc + m[key], 0) / (metricsList.length || 1);

  return {
    fixtures: results.length,
    passed,
    failed,
    passRate: results.length ? passed / results.length : 0,
    avgDurationMs,
    p95DurationMs: p95(durations),
    avgActionsCompleted: avgActions,
    avgVictoryRate: avgMetric('victoryRate'),
    avgTurns: avgMetric('avgTurns'),
    avgExpGained: avgMetric('expGained'),
    avgLevelUps: avgMetric('levelUps'),
    avgEliteDropRate: avgMetric('eliteDropRate'),
    avgMsPerAp: avgMetric('msPerAp'),
    avgApPerAction: avgMetric('apPerAction'),
    details,
  };
};

async function main() {
  const args = parseArgs(process.argv);
  const names = listFixtureNames();
  const targetNames =
    args.mode === 'fast'
      ? names.filter((n) => ['baseline', 'turn-limit', 'no-drop'].includes(n))
      : names;

  const results: Array<{
    name: string;
    result: SimulationResult;
    metrics: FixtureMetrics;
  }> = [];

  for (const name of targetNames) {
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

    const metrics = computeMetrics(result, fixture);
    results.push({ name, result, metrics });

    if (args.report === 'pretty') {
      printFixturePretty(name, result, metrics);
    }
  }

  const summary = aggregateResults(results);
  const compareResult = compareWithBaseline(
    summary,
    args.compare,
    args.tolerance,
  );

  if (args.report === 'json') {
    const payload = JSON.stringify(
      { summary, compare: compareResult },
      null,
      2,
    );
    if (args.out) {
      const target = path.resolve(args.out);
      fs.writeFileSync(target, payload, 'utf-8');
      console.log(`JSON 리포트를 저장했습니다: ${target}`);
    } else {
      console.log(payload);
    }
  } else {
    printSummaryPretty(summary, compareResult);
  }

  if (compareResult.exceeded && args.strict) {
    process.exit(1);
  }
}

const printFixturePretty = (
  name: string,
  result: SimulationResult,
  metrics: FixtureMetrics,
) => {
  console.log(`\n=== ${name} ===`);
  console.log('result:');
  console.log(
    `  actions        : ${result.summary.actionsCompleted}/${result.summary.actionsAttempted}`,
  );
  console.log(`  ap consumed   : ${result.summary.apConsumed}`);
  console.log(`  duration      : ${result.summary.durationMs} ms`);
  console.log(
    `  final state   : v${result.summary.finalVersion}, floor=${result.summary.finalFloor}, progress=${result.summary.finalProgress}`,
  );

  console.log('  metrics       :');
  console.log(`    victory rate : ${(metrics.victoryRate * 100).toFixed(1)}%`);
  console.log(`    avg turns    : ${metrics.avgTurns.toFixed(2)}`);
  console.log(`    exp gained   : ${metrics.expGained.toFixed(2)}`);
  console.log(`    level ups    : ${metrics.levelUps.toFixed(2)}`);
  console.log(
    `    elite drop%  : ${(metrics.eliteDropRate * 100).toFixed(1)}%`,
  );
  console.log(`    ms per AP    : ${metrics.msPerAp.toFixed(2)}`);
  console.log(`    ap per action: ${metrics.apPerAction.toFixed(3)}`);

  if (result.fixtureCheck) {
    console.log(
      'fixture check :',
      result.fixtureCheck.passed ? 'PASS' : 'FAIL',
    );
    result.fixtureCheck.mismatches.forEach((m) => console.log(`  - ${m}`));
  }
};

const printSummaryPretty = (summary: Aggregate, compare?: CompareResult) => {
  console.log('\n=== summary ===');
  console.log(`fixtures       : ${summary.fixtures}`);
  console.log(
    `pass rate      : ${summary.passed}/${summary.fixtures} (${(summary.passRate * 100).toFixed(1)}%)`,
  );
  console.log(`avg duration   : ${summary.avgDurationMs.toFixed(1)} ms`);
  console.log(`p95 duration   : ${summary.p95DurationMs.toFixed(1)} ms`);
  console.log(`avg actions    : ${summary.avgActionsCompleted.toFixed(2)}`);
  console.log(`avg victory%   : ${(summary.avgVictoryRate * 100).toFixed(1)}%`);
  console.log(`avg turns      : ${summary.avgTurns.toFixed(2)}`);
  console.log(`avg exp gain   : ${summary.avgExpGained.toFixed(2)}`);
  console.log(`avg level ups  : ${summary.avgLevelUps.toFixed(2)}`);
  console.log(
    `avg elite drop : ${(summary.avgEliteDropRate * 100).toFixed(1)}%`,
  );
  console.log(`avg ms/AP      : ${summary.avgMsPerAp.toFixed(2)}`);
  console.log(`avg ap/action  : ${summary.avgApPerAction.toFixed(3)}`);

  if (compare?.found) {
    console.log('baseline cmp  :');
    compare.messages.forEach((m) => console.log(`  - ${m}`));
  }

  const failed = Object.entries(summary.details).filter(([, d]) => !d.passed);
  if (failed.length) {
    console.log('failed fixtures:');
    failed.forEach(([name, d]) => {
      console.log(`- ${name}`);
      d.mismatches.forEach((m) => console.log(`  - ${m}`));
    });
  }
};

const compareWithBaseline = (
  summary: Aggregate,
  baselinePath: string | undefined,
  tolerance: number,
): CompareResult => {
  if (!baselinePath) {
    return { found: false, tolerance, exceeded: false, messages: [] };
  }

  const abs = path.resolve(baselinePath);
  if (!fs.existsSync(abs)) {
    return {
      found: false,
      tolerance,
      exceeded: false,
      messages: [`baseline not found: ${abs}`],
    };
  }

  let baselineRaw: unknown;
  try {
    baselineRaw = JSON.parse(fs.readFileSync(abs, 'utf-8')) as unknown;
  } catch (error) {
    const message =
      error instanceof Error
        ? `baseline parse error: ${error.message}`
        : 'baseline parse error: unknown';
    return {
      found: false,
      tolerance,
      exceeded: false,
      messages: [message],
    };
  }

  const baseline = (() => {
    // reports/baseline.full.json 형태: { summary: Aggregate, compare: ... }
    // 과거/간소 형태: Aggregate
    if (!baselineRaw || typeof baselineRaw !== 'object') {
      return null;
    }
    const obj = baselineRaw as Record<string, unknown>;
    const candidate = obj.summary ?? baselineRaw;
    if (!candidate || typeof candidate !== 'object') return null;

    const c = candidate as Record<string, unknown>;
    const keys = ['avgDurationMs', 'p95DurationMs', 'passRate'] as const;
    const ok = keys.every(
      (k) => typeof c[k] === 'number' && Number.isFinite(c[k]),
    );
    return ok ? (candidate as Aggregate) : null;
  })();

  if (!baseline) {
    return {
      found: true,
      tolerance,
      exceeded: true,
      messages: [
        `baseline format invalid: ${abs} (expected Aggregate or {summary: Aggregate}). regenerate: pnpm sim:all --mode full --report json --out reports/baseline.full.json`,
      ],
    };
  }

  const msgs: string[] = [];
  let exceeded = false;

  const checks: Array<{
    label: string;
    current: number;
    base: number;
    minDenom?: number;
  }> = [
    {
      label: 'avg duration',
      current: summary.avgDurationMs,
      base: baseline.avgDurationMs,
      // durationMs는 수 ms 단위로 흔들릴 수 있어, baseline이 매우 작으면 상대 오차가 과도해진다.
      minDenom: 10,
    },
    {
      label: 'p95 duration',
      current: summary.p95DurationMs,
      base: baseline.p95DurationMs,
      minDenom: 10,
    },
    { label: 'pass rate', current: summary.passRate, base: baseline.passRate },
  ];

  for (const check of checks) {
    const denom =
      check.minDenom !== undefined
        ? Math.max(check.base, check.minDenom)
        : check.base || 0.0001; // avoid div0
    const diff = (check.current - check.base) / denom;
    if (Math.abs(diff) > tolerance) {
      exceeded = true;
      msgs.push(
        `${check.label} drift ${(diff * 100).toFixed(1)}% (current=${check.current.toFixed(3)}, baseline=${check.base.toFixed(3)})`,
      );
    }
  }

  return { found: true, tolerance, exceeded, messages: msgs };
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
