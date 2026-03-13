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

const mockFetchReports = vi.fn();
vi.mock('../../src/scraper/api-client.js', () => ({
  fetchReports: (...args: unknown[]) => mockFetchReports(...args),
}));

vi.mock('../../src/utils/paths.js', () => ({
  getDataDir: () => '/tmp/kidsnote-cli-test-report-data',
  getCacheBaseDir: () => '/tmp/kidsnote-cli-test-report-cache',
}));

const { handleReport } = await import('../../src/commands/report.js');
const { writeCache } = await import('../../src/cache/index.js');

const TEST_CACHE_DIR = '/tmp/kidsnote-cli-test-report-cache';

function todayKST(): string {
  return dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
}

function captureStdout(): { getOutput: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  });
  return { getOutput: () => chunks.join(''), restore: () => spy.mockRestore() };
}

describe('report command', () => {
  beforeEach(() => {
    mockResolveAuth.mockReset();
    mockFetchReports.mockReset();
  });

  afterEach(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  it('fetches reports for --today and outputs JSON', async () => {
    const today = todayKST();
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchReports.mockResolvedValue([{ id: 1, date_written: today, content: 'hello' }]);

    const out = captureStdout();
    try {
      await handleReport({ today: true });
    } finally {
      out.restore();
    }

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].date).toBe(today);
    expect(parsed[0].items).toHaveLength(1);
    expect(parsed[0].items[0].content).toBe('hello');
  });

  it('uses cache when available', async () => {
    const today = todayKST();
    await writeCache('reports', today, [{ id: 99, date_written: today, content: 'cached' }]);

    const out = captureStdout();
    try {
      await handleReport({ today: true });
    } finally {
      out.restore();
    }

    expect(mockResolveAuth).not.toHaveBeenCalled();
    expect(mockFetchReports).not.toHaveBeenCalled();

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed[0].items[0].id).toBe(99);
  });

  it('skips cache when --no-cache is used', async () => {
    const today = todayKST();
    await writeCache('reports', today, [{ id: 99 }]);

    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchReports.mockResolvedValue([{ id: 1, date_written: today, content: 'fresh' }]);

    const out = captureStdout();
    try {
      await handleReport({ today: true, cache: false });
    } finally {
      out.restore();
    }

    expect(mockFetchReports).toHaveBeenCalled();
    const parsed = JSON.parse(out.getOutput());
    expect(parsed[0].items[0].id).toBe(1);
  });

  it('throws DateRangeError for conflicting options', async () => {
    await expect(handleReport({ today: true, thisWeek: true })).rejects.toThrow(
      '동시에 사용할 수 없습니다',
    );
  });

  it('throws DateRangeError when no date option given', async () => {
    await expect(handleReport({})).rejects.toThrow('날짜 범위를 지정해주세요');
  });

  it('passes date range to fetchReports', async () => {
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchReports.mockResolvedValue([]);

    const out = captureStdout();
    try {
      await handleReport({ from: '2026-03-10', to: '2026-03-12' });
    } finally {
      out.restore();
    }

    expect(mockFetchReports).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-03-10', to: '2026-03-12', childId: 42 }),
    );
  });

  it('caches fetched reports by date', async () => {
    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchReports.mockResolvedValue([
      { id: 1, date_written: '2026-03-10', content: 'a' },
      { id: 2, date_written: '2026-03-11', content: 'b' },
    ]);

    const out = captureStdout();
    try {
      await handleReport({ from: '2026-03-10', to: '2026-03-11' });
    } finally {
      out.restore();
    }

    const { readCache } = await import('../../src/cache/index.js');
    const cached10 = await readCache<unknown[]>('reports', '2026-03-10');
    const cached11 = await readCache<unknown[]>('reports', '2026-03-11');
    expect(cached10).toHaveLength(1);
    expect(cached11).toHaveLength(1);
  });

  it('fetches only missing dates when partial cache exists', async () => {
    await writeCache('reports', '2026-03-10', [
      { id: 1, date_written: '2026-03-10', content: 'cached day' },
    ]);

    mockResolveAuth.mockResolvedValue({ cookie: 'c', childId: 42, centerId: 100 });
    mockFetchReports.mockResolvedValue([
      { id: 2, date_written: '2026-03-11', content: 'fetched day' },
    ]);

    const out = captureStdout();
    try {
      await handleReport({ from: '2026-03-10', to: '2026-03-11' });
    } finally {
      out.restore();
    }

    expect(mockFetchReports).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-03-11', to: '2026-03-11' }),
    );

    const parsed = JSON.parse(out.getOutput());
    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-03-10');
    expect(parsed[0].items[0].content).toBe('cached day');
    expect(parsed[1].date).toBe('2026-03-11');
    expect(parsed[1].items[0].content).toBe('fetched day');
  });
});
