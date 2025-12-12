#!/usr/bin/env ts-node
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PrismaClient } from '@prisma/client';

type RunOptions = {
  stdio?: 'inherit' | 'pipe';
  env?: NodeJS.ProcessEnv;
};

const run = (command: string, args: string[], options: RunOptions = {}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      shell: false,
      env: options.env ?? process.env,
    });

    child.once('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });

const runIgnoreError = async (command: string, args: string[]) => {
  try {
    await run(command, args, { stdio: 'inherit' });
  } catch {
    // best-effort
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const confirm = async (rl: readline.Interface, message: string) => {
  const answer = (await rl.question(`${message} (y/N) `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
};

const ensureDockerServices = async () => {
  await runIgnoreError('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
  await sleep(1_000);
};

const ensureDockerDbExists = async (dbName: string) => {
  const containerName =
    process.env.POSTGRES_CONTAINER ?? 'git-dungeon-postgres';
  const pgUser = process.env.POSTGRES_USER ?? 'gitdungeon';
  await runIgnoreError('docker', [
    'exec',
    containerName,
    'createdb',
    '-U',
    pgUser,
    dbName,
  ]);
};

async function main() {
  const rl = readline.createInterface({ input, output });
  const noWait =
    process.argv.includes('--no-wait') || process.env.SIM_NO_WAIT === 'true';

  const simDbUrl = process.env.SIM_DATABASE_URL;
  if (!simDbUrl) {
    throw new Error(
      'SIM_DATABASE_URL이 설정되어 있지 않습니다. .env에 시뮬레이션용 임시 DB 경로를 반드시 지정하세요.',
    );
  }
  const parsed = new URL(simDbUrl);
  const dbName =
    parsed.pathname.replace(/^\/+/, '') ||
    process.env.SIM_DB_NAME ||
    'git_dungeon_sim';

  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes(dbName)) {
    console.log(
      `현재 DATABASE_URL과 무관하게 임시 DB(${dbName})로만 실행합니다. 필요하면 SIM_DATABASE_URL을 지정하세요.`,
    );
  }

  const baseEnv = {
    ...process.env,
    DATABASE_URL: simDbUrl,
    SEED_WITH_SAMPLES: 'false',
  };

  const modeInput = (
    await rl.question(
      `\n모드를 선택하세요:\n  1) 자동 시뮬레이션(commit) 플로우\n  2) 임시 DB 삭제/생성/초기화만 수행\n선택 (1/2, default 1) `,
    )
  )
    .trim()
    .toLowerCase();
  const mode = modeInput === '2' ? 2 : 1;

  await ensureDockerServices();

  const dropAndRecreateDb = async () => {
    const containerName =
      process.env.POSTGRES_CONTAINER ?? 'git-dungeon-postgres';
    const pgUser = process.env.POSTGRES_USER ?? 'gitdungeon';

    // 1) 다른 세션 terminate (best-effort)
    const terminateSql = `SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`;
    await runIgnoreError('docker', [
      'exec',
      containerName,
      'psql',
      '-U',
      pgUser,
      '-d',
      'postgres',
      '-c',
      terminateSql,
    ]);

    // 2) 강제 drop (Postgres 13+)
    const dropArgs = [
      'exec',
      containerName,
      'dropdb',
      '-U',
      pgUser,
      '--if-exists',
      '--force',
      dbName,
    ];
    try {
      await run('docker', dropArgs);
    } catch {
      // fallback to SQL drop if --force not supported
      const dropSql = `DROP DATABASE IF EXISTS "${dbName}";`;
      await run('docker', [
        'exec',
        containerName,
        'psql',
        '-U',
        pgUser,
        '-d',
        'postgres',
        '-c',
        dropSql,
      ]);
    }

    // 3) recreate
    await run('docker', [
      'exec',
      containerName,
      'createdb',
      '-U',
      pgUser,
      dbName,
    ]);
  };

  if (mode === 2) {
    console.log(`\n[MODE 2] 임시 DB(${dbName}) 삭제/재생성/초기화 ...`);
    // mode 2는 DB가 이미 있어도 강제로 재생성한다.
    await dropAndRecreateDb();
    await run('pnpm', ['db:reset'], { env: baseEnv });
    console.log('[DONE] 임시 DB가 초기화되었습니다.');
    rl.close();
    return;
  }

  // 1) 초기 유저로 reset
  await ensureDockerDbExists(dbName);
  console.log('\n[1/3] 임시 DB reset(마이그레이션+seed) ...');
  await run('pnpm', ['db:reset'], { env: baseEnv });

  const prisma = new PrismaClient({
    datasources: {
      db: { url: simDbUrl },
    },
  });
  try {
    const seedEmail = process.env.SIM_USER_EMAIL ?? 'admin@example.com';
    const user = await prisma.user.findUnique({
      where: { email: seedEmail },
    });
    if (!user) {
      throw new Error(`seed 유저를 찾을 수 없습니다. email=${seedEmail}`);
    }

    const apInput = (
      await rl.question(
        '\n[2/3] 몇 AP(=max-actions) 만큼 실행할까요? (default 3) ',
      )
    ).trim();
    const ap = Number(apInput || '3');
    if (!Number.isFinite(ap) || ap <= 0) {
      throw new Error('AP는 1 이상의 숫자여야 합니다.');
    }

    const seed =
      (
        await rl.question('seed 문자열을 입력하세요. (default baseline) ')
      ).trim() || 'baseline';

    await prisma.dungeonState.update({
      where: { userId: user.id },
      data: { ap },
    });
    console.log(`AP를 ${ap}로 세팅했습니다 (userId=${user.id}).`);

    const skipInventory = await confirm(
      rl,
      '드랍 인벤토리 적재를 스킵할까요? (--skip-inventory)',
    );

    console.log('\n시뮬레이션 실행중 ...\n');
    const simulateArgs = [
      'ts-node',
      'scripts/simulate.ts',
      '--user',
      user.id,
      '--seed',
      seed,
      '--max-actions',
      String(ap),
      '--commit',
      '--use-db-state',
      '--lock',
    ];
    if (skipInventory) simulateArgs.push('--skip-inventory');

    await run('pnpm', simulateArgs, { env: baseEnv });

    if (!noWait) {
      await rl.question(
        '\n[PAUSE] 시뮬레이션이 완료되었습니다. 임시 DB를 확인한 뒤 Enter를 누르면 reset 합니다. (자동 reset: --no-wait 또는 SIM_NO_WAIT=true)\n> ',
      );
    } else {
      console.log(
        '\n[NO-WAIT] 시뮬레이션이 완료되었습니다. 자동으로 임시 DB를 reset 합니다...',
      );
    }

    // 3) db reset
    console.log('\n[3/3] 임시 DB reset ...');
    await run('pnpm', ['db:reset'], { env: baseEnv });
    console.log('\n[DONE] 임시 DB reset 완료. sim:commit-flow를 종료합니다.');
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
