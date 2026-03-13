import { type BrowserContext, chromium } from 'playwright';

const LOGIN_URL = 'https://www.kidsnote.com/login';
const LOGIN_TIMEOUT_MS = 3_000;

export interface PlaywrightLoginResult {
  cookie: string;
  childId?: number;
  expiresAt?: number;
}

export async function loginWithPlaywright(
  username: string,
  password: string,
): Promise<PlaywrightLoginResult> {
  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | undefined;

  try {
    context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT_MS });
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("로그인")');

    await page.waitForFunction(() => !window.location.href.includes('/login'), {
      timeout: LOGIN_TIMEOUT_MS,
    });

    const cookies = await context.cookies();
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    if (!cookie) {
      throw new Error('로그인 성공했지만 쿠키가 설정되지 않았습니다');
    }

    let childId: number | undefined;
    const childIdCookie = cookies.find((c) => c.name === 'child_id');
    if (childIdCookie) {
      childId = Number(childIdCookie.value);
    }

    const expiresAt = extractEarliestExpiry(cookies);

    return { cookie, childId, expiresAt };
  } finally {
    await context?.close();
    await browser.close();
  }
}

export async function extractCookiesFromContext(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

function extractEarliestExpiry(cookies: { expires: number }[]): number | undefined {
  const now = Date.now() / 1000;
  let earliest: number | undefined;

  for (const c of cookies) {
    // Playwright: expires = -1 means session cookie (no expiry), >0 is Unix timestamp in seconds
    if (c.expires > 0 && c.expires > now) {
      const ms = c.expires * 1000;
      earliest = earliest === undefined ? ms : Math.min(earliest, ms);
    }
  }

  return earliest;
}
