import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import { getInstallDir } from '../utils/paths.js';

const INSTALL_DIR = getInstallDir();

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('최신 버전으로 업데이트')
    .action(async () => {
      try {
        await handleUpdate();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} ${args.join(' ')} 실행 실패: ${stderr || err.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function readVersion(dir: string): Promise<string> {
  const raw = await readFile(join(dir, 'package.json'), 'utf-8');
  const pkg: { version?: string } = JSON.parse(raw);
  return pkg.version ?? 'unknown';
}

export async function handleUpdate(): Promise<void> {
  const previousVersion = await readVersion(INSTALL_DIR);

  await run('git', ['fetch', '--depth', '1', 'origin', 'main'], INSTALL_DIR);
  const local = await run('git', ['rev-parse', 'HEAD'], INSTALL_DIR);
  const remote = await run('git', ['rev-parse', 'origin/main'], INSTALL_DIR);

  if (local === remote) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        action: 'update',
        updated: false,
        version: previousVersion,
        message: '이미 최신 버전입니다',
      })}\n`,
    );
    return;
  }

  await run('git', ['reset', '--hard', 'origin/main'], INSTALL_DIR);
  await run('npm', ['install', '--no-fund', '--no-audit'], INSTALL_DIR);

  const newVersion = await readVersion(INSTALL_DIR);

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action: 'update',
      updated: true,
      previousVersion,
      version: newVersion,
    })}\n`,
  );
}
