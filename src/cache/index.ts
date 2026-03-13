import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCacheBaseDir } from '../utils/paths.js';

const CACHE_DIR = join(getCacheBaseDir(), 'daily');

export type CacheCategory = 'reports' | 'notices';

function buildPath(category: CacheCategory, date: string): string {
  return join(CACHE_DIR, `${category}-${date}.json`);
}

export async function readCache<T>(category: CacheCategory, date: string): Promise<T | null> {
  try {
    const raw = await readFile(buildPath(category, date), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(category: CacheCategory, date: string, data: T): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(buildPath(category, date), JSON.stringify(data, null, 2), 'utf8');
}

export async function listCachedDates(category: CacheCategory): Promise<string[]> {
  try {
    const files = await readdir(CACHE_DIR);
    const prefix = `${category}-`;
    return files
      .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
      .map((f) => f.slice(prefix.length, -5))
      .sort();
  } catch {
    return [];
  }
}

export function getCacheDir(): string {
  return CACHE_DIR;
}
