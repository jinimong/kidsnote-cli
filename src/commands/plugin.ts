import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { listPlugins, resetPluginCache } from '../plugins/loader.js';
import { getPluginsDir } from '../utils/paths.js';

export function registerPluginCommand(program: Command): void {
  const cmd = program.command('plugin').description('플러그인 관리');

  cmd
    .command('install <code>')
    .description('초대 코드로 플러그인을 설치합니다')
    .action(async (code: string) => {
      try {
        await handleInstall(code);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('list')
    .description('설치된 플러그인 목록을 확인합니다')
    .action(async () => {
      try {
        await handleList();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('remove <name>')
    .description('플러그인을 제거합니다')
    .action(async (name: string) => {
      try {
        await handleRemove(name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}

function decodeInviteCode(code: string): string {
  try {
    const decoded = Buffer.from(code, 'base64').toString('utf-8');
    if (!decoded.startsWith('https://')) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }
    return decoded;
  } catch {
    throw new Error('유효하지 않은 초대 코드입니다. 코드를 다시 확인해주세요.');
  }
}

async function downloadPlugin(url: string): Promise<{ name: string; content: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`플러그인 다운로드 실패 (HTTP ${res.status}). 초대 코드를 확인해주세요.`);
  }

  const content = await res.text();

  const urlPath = new URL(url).pathname;
  const segments = urlPath.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] ?? 'plugin.js';
  const name = fileName.endsWith('.js') ? fileName : `${fileName}.js`;

  return { name, content };
}

async function handleInstall(code: string): Promise<void> {
  const url = decodeInviteCode(code);
  const { name, content } = await downloadPlugin(url);

  const dir = getPluginsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const destPath = join(dir, name);
  writeFileSync(destPath, content, { mode: 0o600 });

  resetPluginCache();
  const plugins = await listPlugins();
  const installed = plugins.find(
    (p) => name.includes(p.name) || p.name === name.replace('.js', ''),
  );

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action: 'plugin.install',
      file: name,
      plugin: installed ? { name: installed.name, version: installed.version } : null,
    })}\n`,
  );
}

async function handleList(): Promise<void> {
  const plugins = await listPlugins();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action: 'plugin.list',
      plugins: plugins.map((p) => ({ name: p.name, version: p.version })),
      count: plugins.length,
    })}\n`,
  );
}

async function handleRemove(name: string): Promise<void> {
  const dir = getPluginsDir();
  if (!existsSync(dir)) {
    throw new Error('설치된 플러그인이 없습니다.');
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const target = files.find((f) => f === name || f === `${name}.js` || f.includes(name));

  if (!target) {
    throw new Error(`'${name}' 플러그인을 찾을 수 없습니다.`);
  }

  unlinkSync(join(dir, target));
  resetPluginCache();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action: 'plugin.remove',
      removed: target,
    })}\n`,
  );
}
