import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { describe, expect, it } from 'vitest';
import type { NoticeItem } from '../../src/scraper/api-client.js';
import {
  extractDateKST,
  filterNoticesByDateRange,
  filterReportsByDateRange,
  stripHtmlTags,
} from '../../src/scraper/parser.js';
import type { ReportItem } from '../../src/types.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const makeReport = (id: number, dateWritten: string): ReportItem =>
  ({ id, date_written: dateWritten }) as unknown as ReportItem;

describe('filterReportsByDateRange', () => {
  const reports = [
    makeReport(1, '2026-03-10'),
    makeReport(2, '2026-03-12'),
    makeReport(3, '2026-03-14'),
    makeReport(4, '2026-03-16'),
  ];

  it('filters by from date', () => {
    const filtered = filterReportsByDateRange(reports, '2026-03-12');
    expect(filtered.map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it('filters by to date', () => {
    const filtered = filterReportsByDateRange(reports, undefined, '2026-03-12');
    expect(filtered.map((r) => r.id)).toEqual([1, 2]);
  });

  it('filters by both from and to', () => {
    const filtered = filterReportsByDateRange(reports, '2026-03-12', '2026-03-14');
    expect(filtered.map((r) => r.id)).toEqual([2, 3]);
  });

  it('returns all when no range specified', () => {
    const filtered = filterReportsByDateRange(reports);
    expect(filtered).toHaveLength(4);
  });
});

describe('stripHtmlTags', () => {
  it('removes HTML tags', () => {
    expect(stripHtmlTags('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('handles plain text', () => {
    expect(stripHtmlTags('just text')).toBe('just text');
  });

  it('trims whitespace', () => {
    expect(stripHtmlTags('  <br>  ')).toBe('');
  });
});

function toISOInKST(dateStr: string, hour = 10): string {
  return dayjs.tz(`${dateStr} ${String(hour).padStart(2, '0')}:00:00`, 'Asia/Seoul').toISOString();
}

const makeNotice = (id: number, created: string): NoticeItem =>
  ({ id, created }) as unknown as NoticeItem;

describe('filterNoticesByDateRange', () => {
  const notices = [
    makeNotice(1, toISOInKST('2026-03-10')),
    makeNotice(2, toISOInKST('2026-03-12')),
    makeNotice(3, toISOInKST('2026-03-14')),
    makeNotice(4, toISOInKST('2026-03-16')),
  ];

  it('filters by from date', () => {
    const filtered = filterNoticesByDateRange(notices, '2026-03-12');
    expect(filtered.map((n) => n.id)).toEqual([2, 3, 4]);
  });

  it('filters by both from and to', () => {
    const filtered = filterNoticesByDateRange(notices, '2026-03-12', '2026-03-14');
    expect(filtered.map((n) => n.id)).toEqual([2, 3]);
  });

  it('returns all when no range specified', () => {
    const filtered = filterNoticesByDateRange(notices);
    expect(filtered).toHaveLength(4);
  });
});

describe('extractDateKST', () => {
  it('converts UTC ISO to KST date', () => {
    expect(extractDateKST('2026-03-10T15:00:00.000Z')).toBe('2026-03-11');
  });

  it('keeps same day when within KST day', () => {
    expect(extractDateKST('2026-03-10T01:00:00.000Z')).toBe('2026-03-10');
  });
});
