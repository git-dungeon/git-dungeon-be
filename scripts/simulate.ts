#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';
import { SimulationRunner } from '../src/simulation/sim-runner';
import { getFixture, listFixtureNames } from '../src/simulation/fixtures';
import type { SimulationResult } from '../src/simulation/types';

type ParsedArgs = {
  user?: string;
  seed?: string;
  maxActions?: number;
  dryRun: boolean;
  commit: boolean;
  report: 'pretty' | 'json';
  out?: string;
  fixture?: string;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const args: ParsedArgs = {
    dryRun: true,
    commit: false,
    report: 'pretty',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--user':
      case '-u':
        args.user = argv[++i];
        break;
      case '--seed':
      case '-s':
        args.seed = argv[++i];
        break;
      case '--max-actions':
      case '-m':
        args.maxActions = Number(argv[++i]);
        break;
      case '--fixture':
        args.fixture = argv[++i];
        break;
      case '--dry-run':
        args.dryRun = true;
        args.commit = false;
        break;
      case '--commit':
        args.commit = true;
        args.dryRun = false;
        break;
      case '--report':
        args.report = (argv[++i] as ParsedArgs['report']) ?? 'pretty';
        break;
      case '--out':
        args.out = argv[++i];
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
  console.log(`Dungeon simulation runner

필수:
  --user, -u          실행 대상 userId (fixture 선택 시에도 요구)
  --seed, -s          RNG seed
  --max-actions, -m   최대 실행 횟수

옵션:
  --fixture <name>    준비된 시나리오 실행 (${listFixtureNames().join(', ')})
  --dry-run           상태/로그를 DB에 기록하지 않고 실행 (기본)
  --commit            DB에 상태/로그를 기록 (DATABASE_URL 필요)
  --report <pretty|json> 출력 형식 (기본 pretty)
  --out <path>        report=json일 때 파일로 저장
  --help, -h          도움말
`);
};

const formatPretty = (result: SimulationResult) => {
  console.log('--- 실행 결과 ---');
  console.log(
    `actions ${result.summary.actionsCompleted}/${result.summary.actionsAttempted}, apConsumed=${result.summary.apConsumed}, duration=${result.summary.durationMs}ms`,
  );
  console.log(
    `final: v${result.summary.finalVersion}, ap=${result.summary.finalAp}, floor=${result.summary.finalFloor}, progress=${result.summary.finalProgress}`,
  );

  if (result.fixtureCheck) {
    const status = result.fixtureCheck.passed ? 'PASS' : 'FAIL';
    console.log(`fixture[${result.fixtureCheck.name}]: ${status}`);
    if (result.fixtureCheck.mismatches.length) {
      result.fixtureCheck.mismatches.forEach((m) => console.log(`  - ${m}`));
    }
  }

  result.steps.forEach((step) => {
    console.log(
      `#${step.actionCounter} ${step.selectedEvent} => hp:${step.stateAfter.hp} ap:${step.stateAfter.ap} floor:${step.stateAfter.floor} prog:${step.stateAfter.floorProgress} v${step.stateAfter.version}`,
    );
  });
};

async function main() {
  const args = parseArgs(process.argv);

  if (!args.user || !args.seed || !args.maxActions) {
    printHelp();
    throw new Error('--user, --seed, --max-actions 옵션은 필수입니다.');
  }

  const fixture = getFixture(args.fixture);
  if (args.fixture && !fixture) {
    throw new Error(
      `알 수 없는 fixture: ${args.fixture}. 사용 가능: ${listFixtureNames().join(', ')}`,
    );
  }

  const runner = new SimulationRunner(args.commit);
  const result = await runner.run(
    {
      userId: args.user,
      seed: fixture?.seed ?? args.seed,
      maxActions: args.maxActions,
      dryRun: args.dryRun,
      initialState: fixture?.initialState,
      fixtureName: args.fixture,
    },
    fixture
      ? {
          name: args.fixture ?? fixture.seed,
          snapshot: fixture,
        }
      : undefined,
  );

  if (args.report === 'json') {
    const payload = JSON.stringify(result, null, 2);
    if (args.out) {
      const target = path.resolve(args.out);
      fs.writeFileSync(target, payload, 'utf-8');
      console.log(`JSON 리포트를 저장했습니다: ${target}`);
    } else {
      console.log(payload);
    }
  } else {
    formatPretty(result);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
