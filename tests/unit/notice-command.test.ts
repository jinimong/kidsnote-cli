import { rm } from 'node:fs/promises';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

dayjs.extend(utc);
dayjs.extend(timezone);

const mockResolveAuth = vi.fn();
vi.mock('../../src/utils/resolve-auth.js', () => ({
  resolveAuth: (...args: unknown[]) => mockResolveAuth(...args),
}));

const mockFetchNotices = vi.fn();
vi.mock('../../src/scraper/api-client.js', () => ({
  fetchNotices: (...args: unknown[]) => mockFetchNotices(...args),
}));

vi.mock('../../src/utils/paths.js', () => ({
  getDataDir: () => '/tmp/kidsnote-cli-test-notice-data',
  getCacheBaseDir: () => '/tmp/kidsnote-cli-test-notice-cache',
}));

const { handleNotice } = await import('../../src/commands/notice.js');
const { writeCache } = await import('../../src/cache/index.js');

const TEST_CACHE_DIR = '/tmp/kidsnote-cli-test-notice-cache';

function todayKST(): string {
  return dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
}

function toISOInKST(dateStr: string, hour = 10): string {
  return dayjs.tz(`${dateStr} ${String(hour).padStart(2, '0')}:00:00`, 'Asia/Seoul').toISOString();
}

function captureStdout(): { getOutput: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  });
  return { getOutput: () => chunks.join(''), restore: () => spy.mockRestore() };
}

describe('notice command', () => {
  beforeEach(() => {
    mockResolveAuth.mockReset();
    mockFetchNotices.mockReset();
  });

  afterEach(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  it('fetches notices for --today and outputs JSON', async () => {
    const today = todayKST();
    const created = toISOInKST(today);
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchNotices.mockResolvedValue([
      { id: 1, created, title: '소풍 안내', content: '내일 소풍입니다.' },
    ]);

    const out = captureStdout();
    try {
      await handleNotice({ today: true });
    } finally {
      out.restore();
    }

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].date).toBe(today);
    expect(parsed[0].items).toHaveLength(1);
    expect(parsed[0].items[0].title).toBe('소풍 안내');
  });

  it('uses cache when available', async () => {
    const today = todayKST();
    const created = toISOInKST(today);
    await writeCache('notices', today, [{ id: 99, created, title: 'cached notice' }]);

    const out = captureStdout();
    try {
      await handleNotice({ today: true });
    } finally {
      out.restore();
    }

    expect(mockResolveAuth).not.toHaveBeenCalled();
    expect(mockFetchNotices).not.toHaveBeenCalled();

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed[0].items[0].id).toBe(99);
  });

  it('skips cache when --no-cache is used', async () => {
    const today = todayKST();
    const created = toISOInKST(today);
    await writeCache('notices', today, [{ id: 99 }]);

    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchNotices.mockResolvedValue([{ id: 1, created, title: 'fresh notice' }]);

    const out = captureStdout();
    try {
      await handleNotice({ today: true, cache: false });
    } finally {
      out.restore();
    }

    expect(mockFetchNotices).toHaveBeenCalled();
    const parsed = JSON.parse(out.getOutput());
    expect(parsed[0].items[0].id).toBe(1);
  });

  it('throws DateRangeError for conflicting options', async () => {
    await expect(handleNotice({ today: true, thisWeek: true })).rejects.toThrow(
      '동시에 사용할 수 없습니다',
    );
  });

  it('throws DateRangeError when no date option given', async () => {
    await expect(handleNotice({})).rejects.toThrow('날짜 범위를 지정해주세요');
  });

  it('filters notices by date range from created timestamp', async () => {
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchNotices.mockResolvedValue([
      { id: 1, created: toISOInKST('2026-03-10'), title: 'in range' },
      { id: 2, created: toISOInKST('2026-03-09'), title: 'before range' },
      { id: 3, created: toISOInKST('2026-03-12'), title: 'in range 2' },
      { id: 4, created: toISOInKST('2026-03-13'), title: 'after range' },
    ]);

    const out = captureStdout();
    try {
      await handleNotice({ from: '2026-03-10', to: '2026-03-12' });
    } finally {
      out.restore();
    }

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toHaveLength(3);
    const day10 = parsed.find((d: { date: string }) => d.date === '2026-03-10');
    const day11 = parsed.find((d: { date: string }) => d.date === '2026-03-11');
    const day12 = parsed.find((d: { date: string }) => d.date === '2026-03-12');
    expect(day10.items).toHaveLength(1);
    expect(day10.items[0].id).toBe(1);
    expect(day11.items).toHaveLength(0);
    expect(day12.items).toHaveLength(1);
    expect(day12.items[0].id).toBe(3);
  });

  it('caches fetched notices by date extracted from created', async () => {
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchNotices.mockResolvedValue([
      { id: 1, created: toISOInKST('2026-03-10'), title: 'a' },
      { id: 2, created: toISOInKST('2026-03-11'), title: 'b' },
    ]);

    const out = captureStdout();
    try {
      await handleNotice({ from: '2026-03-10', to: '2026-03-11' });
    } finally {
      out.restore();
    }

    const { readCache } = await import('../../src/cache/index.js');
    const cached10 = await readCache<unknown[]>('notices', '2026-03-10');
    const cached11 = await readCache<unknown[]>('notices', '2026-03-11');
    expect(cached10).toHaveLength(1);
    expect(cached11).toHaveLength(1);
  });

  it('fetches only missing dates when partial cache exists', async () => {
    const created10 = toISOInKST('2026-03-10');
    const created11 = toISOInKST('2026-03-11');

    await writeCache('notices', '2026-03-10', [
      { id: 1, created: created10, title: 'cached notice' },
    ]);

    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchNotices.mockResolvedValue([{ id: 2, created: created11, title: 'fetched notice' }]);

    const out = captureStdout();
    try {
      await handleNotice({ from: '2026-03-10', to: '2026-03-11' });
    } finally {
      out.restore();
    }

    expect(mockFetchNotices).toHaveBeenCalled();

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-03-10');
    expect(parsed[0].items[0].title).toBe('cached notice');
    expect(parsed[1].date).toBe('2026-03-11');
    expect(parsed[1].items[0].title).toBe('fetched notice');
  });
});
