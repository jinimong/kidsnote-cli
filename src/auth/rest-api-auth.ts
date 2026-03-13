const LOGIN_URL = 'https://www.kidsnote.com/api/web/login/';
const REQUEST_TIMEOUT_MS = 3_000;

export class RestAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RestAuthError';
  }
}

export interface RestLoginResult {
  cookie: string;
  expiresAt?: number;
}

export async function loginWithRestApi(
  username: string,
  password: string,
): Promise<RestLoginResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('REST API 로그인 타임아웃 (3초 초과)');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 400 && res.status < 500) {
    throw new RestAuthError(`REST API 로그인 실패 (HTTP ${res.status})`, res.status);
  }

  if (!res.ok && res.status !== 302) {
    throw new Error(`REST API 로그인 실패 (HTTP ${res.status})`);
  }

  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ');

  if (!cookie) {
    throw new Error('REST API 로그인: 세션 쿠키가 응답에 없습니다');
  }

  const expiresAt = parseEarliestExpiry(setCookieHeaders);
  return { cookie, expiresAt };
}

function parseEarliestExpiry(setCookieHeaders: string[]): number | undefined {
  const now = Date.now();
  let earliest: number | undefined;

  for (const header of setCookieHeaders) {
    const attrs = header.split(';').slice(1);
    let expiry: number | undefined;

    for (const attr of attrs) {
      const trimmed = attr.trim();
      const lower = trimmed.toLowerCase();

      if (lower.startsWith('expires=')) {
        const dateStr = trimmed.slice('expires='.length);
        const ms = Date.parse(dateStr);
        if (!Number.isNaN(ms) && ms > now) {
          expiry = expiry === undefined ? ms : Math.min(expiry, ms);
        }
      } else if (lower.startsWith('max-age=')) {
        const seconds = Number.parseInt(trimmed.slice('max-age='.length), 10);
        if (!Number.isNaN(seconds) && seconds > 0) {
          const ms = now + seconds * 1000;
          expiry = expiry === undefined ? ms : Math.min(expiry, ms);
        }
      }
    }

    if (expiry !== undefined) {
      earliest = earliest === undefined ? expiry : Math.min(earliest, expiry);
    }
  }

  return earliest;
}
