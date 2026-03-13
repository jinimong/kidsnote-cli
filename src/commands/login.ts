import type { Command } from 'commander';
import {
  AuthError,
  authenticate,
  loadCredentials,
  loadSession,
  saveCredentials,
} from '../auth/index.js';
import { promptPassword, promptText } from '../utils/prompt.js';

function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      const password = data.split('\n')[0].trim();
      if (!password) {
        reject(new Error('stdin에서 비밀번호를 읽을 수 없습니다.'));
        return;
      }
      resolve(password);
    });
    process.stdin.on('error', reject);
    process.stdin.resume();
  });
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('로그인 및 세션 관리')
    .option('-u, --username <username>', '키즈노트 계정 아이디')
    .option(
      '-p, --password <password>',
      '키즈노트 계정 비밀번호 (⚠ 프로세스 목록에 노출됨, --password-stdin 권장)',
    )
    .option(
      '--password-stdin',
      'stdin에서 비밀번호 읽기 (예: echo "pw" | kidsnote login -u id --password-stdin)',
    )
    .option('--status', '현재 세션 상태 확인')
    .action(async (opts: LoginOptions) => {
      try {
        await handleLogin(opts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}

interface LoginOptions {
  username?: string;
  password?: string;
  passwordStdin?: boolean;
  status?: boolean;
}

async function handleLogin(opts: LoginOptions): Promise<void> {
  if (opts.status) {
    const session = await loadSession();
    if (session) {
      process.stdout.write(
        `${JSON.stringify({
          authenticated: true,
          childId: session.childId ?? null,
          centerId: session.centerId ?? null,
          savedAt: new Date(session.savedAt).toISOString(),
        })}\n`,
      );
    } else {
      process.stdout.write(`${JSON.stringify({ authenticated: false })}\n`);
    }
    return;
  }

  if (opts.password) {
    process.stderr.write(
      '[경고] -p 옵션은 비밀번호가 프로세스 목록(ps)에 노출됩니다. --password-stdin 사용을 권장합니다.\n',
    );
  }

  let username: string;
  let password: string;

  if (opts.passwordStdin) {
    username = opts.username ?? process.env.KIDSNOTE_USERNAME ?? '';
    if (!username) {
      throw new AuthError(
        '--password-stdin 사용 시 -u 옵션 또는 KIDSNOTE_USERNAME 환경변수가 필요합니다.',
      );
    }
    password = await readPasswordFromStdin();
  } else if (opts.username && opts.password) {
    username = opts.username;
    password = opts.password;
  } else {
    const savedCreds = loadCredentials();
    username = await promptText('아이디', savedCreds?.username);
    password = await promptPassword('비밀번호');

    if (!username || !password) {
      throw new AuthError('아이디와 비밀번호를 모두 입력해야 합니다.');
    }
  }

  const result = await authenticate({
    username,
    password,
    forceRefresh: true,
  });

  try {
    saveCredentials({ username });
  } catch (e) {
    process.stderr.write(
      `[경고] 아이디 저장 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action: 'login',
      fromCache: result.fromCache,
      childId: result.childId ?? null,
    })}\n`,
  );
}
