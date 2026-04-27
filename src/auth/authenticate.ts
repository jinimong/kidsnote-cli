import { loginWithPlaywright } from './playwright-auth.js';
import { loginWithRestApi, RestAuthError } from './rest-api-auth.js';
import type { StoredSession } from './session-store.js';
import { loadCredentials, loadSession, saveSession } from './session-store.js';

export interface AuthResult {
  cookie: string;
  childId?: number;
  centerId?: number;
  classId?: number;
  fromCache: boolean;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function authenticate(opts?: {
  username?: string;
  password?: string;
  forceRefresh?: boolean;
}): Promise<AuthResult> {
  if (!opts?.forceRefresh) {
    const existing = await loadSession();
    if (existing) {
      return {
        cookie: existing.cookie,
        childId: existing.childId,
        centerId: existing.centerId,
        classId: existing.classId,
        fromCache: true,
      };
    }
  }

  const creds = resolveCredentials(opts?.username, opts?.password);

  let session: Omit<StoredSession, 'savedAt'>;

  try {
    const restResult = await loginWithRestApi(creds.username, creds.password);
    session = { cookie: restResult.cookie, expiresAt: restResult.expiresAt };
  } catch (restError) {
    if (restError instanceof RestAuthError) {
      throw new AuthError('로그인에 실패했습니다. 아이디 또는 비밀번호를 확인하세요.', restError);
    }

    try {
      const pwResult = await loginWithPlaywright(creds.username, creds.password);
      session = {
        cookie: pwResult.cookie,
        childId: pwResult.childId,
        expiresAt: pwResult.expiresAt,
      };
    } catch (pwError) {
      throw new AuthError('모든 로그인 방법이 실패했습니다. 자격증명을 확인하세요.', {
        restError,
        playwrightError: pwError,
      });
    }
  }

  await saveSession(session);

  return {
    cookie: session.cookie,
    childId: session.childId,
    centerId: session.centerId,
    fromCache: false,
  };
}

function resolveCredentials(
  username?: string,
  password?: string,
): { username: string; password: string } {
  if (username && password) {
    return { username, password };
  }

  const stored = loadCredentials();
  if (stored) {
    const envPass = process.env.KIDSNOTE_PASSWORD;
    if (envPass) return { username: stored.username, password: envPass };

    throw new AuthError(
      '저장된 아이디는 있으나 비밀번호를 찾을 수 없습니다. `kidsnote login`으로 비밀번호를 입력하세요.',
    );
  }

  const envUser = process.env.KIDSNOTE_USERNAME;
  const envPass = process.env.KIDSNOTE_PASSWORD;
  if (envUser && envPass) {
    return { username: envUser, password: envPass };
  }

  throw new AuthError(
    '자격증명을 찾을 수 없습니다. `kidsnote login`으로 로그인하거나, KIDSNOTE_USERNAME/PASSWORD 환경변수를 설정하세요.',
  );
}
