import { describe, expect, it } from 'vitest';
import { buildDailyMarkdown } from '../../src/archive/markdown.js';
import type { AlbumItem, ReportItem } from '../../src/types.js';

describe('buildDailyMarkdown', () => {
  it('renders frontmatter and body sections', () => {
    const report = {
      id: 10,
      date_written: '2026-03-01',
      author_name: '햇님반 교사',
      child_name: '김지안',
      is_sent_from_center: true,
      content: '안녕하세요\n오늘도 즐거웠어요',
      attached_images: [{ id: 1, original_file_name: 'photo.jpg' }],
      attached_videos: [],
    } as unknown as ReportItem;

    const album = {
      id: 20,
      title: '소풍',
      author_name: '햇님반 교사',
      created: '2026-03-01T01:00:00.000Z',
      content: '즐거운 소풍',
      attached_images: [],
      attached_videos: [],
    } as unknown as AlbumItem;

    const rendered = buildDailyMarkdown({
      date: '2026-03-01',
      reports: [report],
      albums: [album],
      mediaEntries: [
        {
          file: '2026-03-01-img-1.jpg',
          type: 'img',
          cdn: { original: 'https://example.com/photo.jpg' },
        },
      ],
    });

    expect(rendered.frontmatter.date).toBe('2026-03-01');
    expect(rendered.frontmatter.sources).toEqual([
      { type: 'report', id: 10 },
      { type: 'album', id: 20 },
    ]);
    expect(rendered.markdown).toContain('## 알림장');
    expect(rendered.markdown).toContain('## 앨범');
    expect(rendered.markdown).toContain('![](2026-03-01-img-1.jpg)');
    expect(rendered.markdown).toContain('- 2026-03-01-img-1.jpg');
  });
});
