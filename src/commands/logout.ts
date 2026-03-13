import type { Command } from 'commander';
import { clearAll } from '../auth/index.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('저장된 자격증명 및 세션 모두 삭제')
    .action(async () => {
      try {
        await clearAll();
        process.stdout.write(`${JSON.stringify({ ok: true, action: 'logout' })}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}
