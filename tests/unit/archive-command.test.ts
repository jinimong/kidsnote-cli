import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildArchive } from '../../src/archive/index.js';

const tempDirs: string[] = [];

describe('buildArchive', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('writes daily markdown without downloading media', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kidsnote-archive-'));
    tempDirs.push(dir);

    const reportsPath = join(dir, 'reports.json');
    const albumsPath = join(dir, 'albums.json');
    const outputDir = join(dir, 'archive');

    await writeFile(
      reportsPath,
      JSON.stringify({
        results: [
          {
            id: 1,
            date_written: '2026-03-01',
            author_name: '햇님반 교사',
            child_name: '김지안',
            is_sent_from_center: true,
            content: '테스트 알림장',
            attached_images: [],
            attached_videos: [],
          },
        ],
      }),
    );

    await writeFile(
      albumsPath,
      JSON.stringify({
        results: [
          {
            id: 2,
            created: '2026-03-01T02:00:00.000Z',
            author_name: '햇님반 교사',
            title: '테스트 앨범',
            content: '테스트 앨범 본문',
            attached_images: [],
            attached_videos: [],
          },
        ],
      }),
    );

    const result = await buildArchive({
      reportsPath,
      albumsPath,
      outputDir,
      skipDownload: true,
    });

    expect(result.datesProcessed).toBe(1);
    const markdown = await readFile(join(outputDir, '2026-03-01.md'), 'utf8');
    expect(markdown).toContain('# 2026-03-01');
    expect(markdown).toContain('테스트 알림장');
    expect(markdown).toContain('테스트 앨범');
  });
});
