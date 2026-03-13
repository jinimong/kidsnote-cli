import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/paths.js', () => ({
  getDataDir: () => '/tmp/kidsnote-cli-test-data',
  getCacheBaseDir: () => '/tmp/kidsnote-cli-test-cache',
}));

const { readCache, writeCache, listCachedDates, getCacheDir } = await import(
  '../../src/cache/index.js'
);

const TEST_CACHE_DIR = '/tmp/kidsnote-cli-test-cache/daily';

describe('cache', () => {
  beforeEach(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
  });

  it('returns null for missing cache entries', async () => {
    expect(await readCache('reports', '2026-03-14')).toBeNull();
  });

  it('writes and reads cache entries', async () => {
    const data = [{ id: 1, content: 'hello' }];
    await writeCache('reports', '2026-03-14', data);
    const loaded = await readCache<typeof data>('reports', '2026-03-14');
    expect(loaded).toEqual(data);
  });

  it('isolates categories', async () => {
    await writeCache('reports', '2026-03-14', { type: 'report' });
    await writeCache('notices', '2026-03-14', { type: 'notice' });
    expect(await readCache('reports', '2026-03-14')).toEqual({ type: 'report' });
    expect(await readCache('notices', '2026-03-14')).toEqual({ type: 'notice' });
  });

  it('lists cached dates sorted', async () => {
    await writeCache('reports', '2026-03-12', {});
    await writeCache('reports', '2026-03-14', {});
    await writeCache('reports', '2026-03-10', {});
    await writeCache('notices', '2026-03-14', {});

    const dates = await listCachedDates('reports');
    expect(dates).toEqual(['2026-03-10', '2026-03-12', '2026-03-14']);
  });

  it('returns empty array when no cache directory exists', async () => {
    expect(await listCachedDates('reports')).toEqual([]);
  });

  it('returns the cache directory path', () => {
    expect(getCacheDir()).toBe(TEST_CACHE_DIR);
  });
});
