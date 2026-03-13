import { type BrowserContext, chromium, type Page } from 'playwright';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

export async function createBrowserSession(cookie: string): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const cookieParts = cookie.split('; ').map((part) => {
    const [name, ...rest] = part.split('=');
    return {
      name,
      value: rest.join('='),
      domain: '.kidsnote.com',
      path: '/',
    };
  });
  await context.addCookies(cookieParts);

  const page = await context.newPage();

  return {
    context,
    page,
    async close() {
      await context.close();
      await browser.close();
    },
  };
}

export async function discoverChildId(session: BrowserSession): Promise<number> {
  const page = session.page;

  let discoveredChildId: number | null = null;

  page.on('request', (request) => {
    const url = request.url();
    const match = url.match(/\/children\/(\d+)\//);
    if (match && !discoveredChildId) {
      discoveredChildId = Number(match[1]);
    }
  });

  await page.goto('https://www.kidsnote.com/service/report', { waitUntil: 'networkidle' });

  if (discoveredChildId) {
    return discoveredChildId;
  }

  const url = page.url();
  const childMatch = url.match(/children\/(\d+)/);
  if (childMatch) {
    return Number(childMatch[1]);
  }

  const cookies = await session.context.cookies();
  const childCookie = cookies.find((c) => c.name === 'child_id');
  if (childCookie) {
    return Number(childCookie.value);
  }

  throw new Error('브라우저 세션에서 child_id를 찾을 수 없습니다');
}
