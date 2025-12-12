#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';
import type { DungeonState } from '@prisma/client';
import {
  SimulationPersistConflictError,
  SimulationRunner,
} from '../src/simulation/sim-runner';
import { getFixture, listFixtureNames } from '../src/simulation/fixtures';
import type { SimulationResult } from '../src/simulation/types';
import { DungeonBatchLockService } from '../src/dungeon/batch/dungeon-batch.lock.service';

type ParsedArgs = {
  user?: string;
  seed?: string;
  maxActions?: number;
  dryRun: boolean;
  commit: boolean;
  report: 'pretty' | 'json';
  out?: string;
  fixture?: string;
  initialStatePath?: string;
  useDbState: boolean;
  lock: boolean;
  skipInventory: boolean;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const args: ParsedArgs = {
    dryRun: true,
    commit: false,
    report: 'pretty',
    useDbState: false,
    lock: false,
    skipInventory: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--':
        // pnpm/npm scripts pass a standalone "--" before forwarded args
        break;
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
      case '--initial-state':
        args.initialStatePath = argv[++i];
        break;
      case '--use-db-state':
        args.useDbState = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        args.commit = false;
        break;
      case '--commit':
        args.commit = true;
        args.dryRun = false;
        break;
      case '--lock':
        args.lock = true;
        break;
      case '--skip-inventory':
        args.skipInventory = true;
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
  --initial-state <path>  DungeonState JSON 파일로 초기 상태 지정
  --use-db-state      commit 모드에서 DB의 dungeonState를 초기 상태로 사용 (fixture/initial-state 없을 때 필수)
  --lock              commit 모드에서 배치 락을 획득한 뒤 실행 (실패 시 exit 2)
  --skip-inventory    드랍 인벤토리(DB insert) 적용 없이 로그만 생성
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

  const fileInitialState: DungeonState | undefined = args.initialStatePath
    ? (JSON.parse(
        fs.readFileSync(path.resolve(args.initialStatePath), 'utf-8'),
      ) as DungeonState)
    : undefined;

  if (args.dryRun && !fixture && !fileInitialState) {
    throw new Error('dry-run은 fixture 또는 --initial-state가 필요합니다.');
  }

  if (args.commit && !fixture && !fileInitialState && !args.useDbState) {
    throw new Error(
      'commit에서 fixture/--initial-state가 없으면 --use-db-state를 명시해야 합니다.',
    );
  }

  let lockService: DungeonBatchLockService | undefined;
  let lockAcquired = false;
  if (args.commit && args.lock) {
    lockService = new DungeonBatchLockService();
    lockAcquired = await lockService.acquire(args.user);
    if (!lockAcquired) {
      console.error(`락 획득 실패로 실행을 중단합니다 (userId=${args.user}).`);
      process.exit(2);
    }
  }

  let runner: SimulationRunner | undefined;
  try {
    runner = new SimulationRunner(args.commit);
    const result = await runner.run(
      {
        userId: args.user,
        seed: fixture?.seed ?? args.seed,
        maxActions: args.maxActions,
        dryRun: args.dryRun,
        initialState: fixture?.initialState ?? fileInitialState,
        fixtureName: args.fixture,
        skipInventoryApply: args.skipInventory,
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
  } finally {
    if (lockAcquired && lockService) {
      await lockService.release(args.user);
      await lockService.onModuleDestroy();
    }
    if (runner) {
      await runner.close();
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof SimulationPersistConflictError) {
    process.exit(3);
  }
  process.exit(1);
});
