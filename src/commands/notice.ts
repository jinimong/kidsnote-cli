import type { Command } from 'commander';
import { readCache, writeCache } from '../cache/index.js';
import { fetchNotices } from '../scraper/api-client.js';
import { extractDateKST, filterNoticesByDateRange } from '../scraper/parser.js';
import type { DailyNoticeEntry, NoticeItem } from '../types.js';
import { DateRangeError, resolveDateRange } from '../utils/date.js';
import { resolveAuth } from '../utils/resolve-auth.js';

export function registerNoticeCommand(program: Command): void {
  program
    .command('notice')
    .description('공지사항 조회')
    .option('--today', '오늘 공지사항 조회')
    .option('--this-week', '이번 주 공지사항 조회 (월요일~오늘)')
    .option('--from <date>', '시작 날짜 (YYYY-MM-DD)')
    .option('--to <date>', '종료 날짜 (YYYY-MM-DD)')
    .option('--no-cache', '캐시 무시하고 새로 가져오기')
    .action(async (opts: NoticeOptions) => {
      try {
        await handleNotice(opts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message })}\n`);
        process.exitCode = 1;
      }
    });
}

interface NoticeOptions {
  today?: boolean;
  thisWeek?: boolean;
  from?: string;
  to?: string;
  cache?: boolean;
}

export async function handleNotice(opts: NoticeOptions): Promise<void> {
  const { from, to } = resolveDateRange({
    today: opts.today,
    thisWeek: opts.thisWeek,
    from: opts.from,
    to: opts.to,
  });

  if (!from || !to) {
    throw new DateRangeError('날짜 범위를 확인할 수 없습니다');
  }

  const dates = generateDateRange(from, to);
  const useCache = opts.cache !== false;

  const cached = new Map<string, NoticeItem[]>();
  const missingDates: string[] = [];

  if (useCache) {
    for (const date of dates) {
      const entry = await readCache<NoticeItem[]>('notices', date);
      if (entry) {
        cached.set(date, entry);
      } else {
        missingDates.push(date);
      }
    }
  } else {
    missingDates.push(...dates);
  }

  if (missingDates.length > 0) {
    const fetchFrom = missingDates[0];
    const fetchTo = missingDates[missingDates.length - 1];

    const auth = await resolveAuth();

    if (!auth.centerId) {
      throw new Error('센터 ID를 찾을 수 없습니다. 재로그인 후 다시 시도하세요.');
    }

    const notices = await fetchNotices({
      cookie: auth.cookie,
      centerId: auth.centerId,
    });

    const filtered = filterNoticesByDateRange(notices, fetchFrom, fetchTo);
    const byDate = groupByDate(filtered, missingDates, (n) => extractDateKST(n.created));

    for (const [date, items] of byDate) {
      cached.set(date, items);
      if (useCache) {
        await writeCache('notices', date, items);
      }
    }
  }

  const result: DailyNoticeEntry[] = dates.map((date) => ({
    date,
    items: cached.get(date) ?? [],
  }));

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function groupByDate<T>(
  items: T[],
  dates: string[],
  getDate: (item: T) => string,
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const date of dates) {
    byDate.set(date, []);
  }
  for (const item of items) {
    const date = getDate(item);
    const bucket = byDate.get(date);
    if (bucket) {
      bucket.push(item);
    }
  }
  return byDate;
}

function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}
