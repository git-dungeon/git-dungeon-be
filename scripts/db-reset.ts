import { spawn } from 'node:child_process';

const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`${command} ${args.join(' ')} exited with code ${code}`),
      );
    });
  });

async function main() {
  await run('pnpm', [
    'exec',
    'prisma',
    'migrate',
    'reset',
    '--force',
    '--skip-generate',
    '--skip-seed',
  ]);
  await run('pnpm', ['db:seed']);
}

main().catch((error) => {
  console.error('[db:reset] failed:', error);
  process.exit(1);
});
