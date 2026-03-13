import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import type { NoticeItem, ReportItem } from '../types.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function filterReportsByDateRange(
  reports: ReportItem[],
  from?: string,
  to?: string,
): ReportItem[] {
  return reports.filter((r) => {
    if (from && r.date_written < from) return false;
    if (to && r.date_written > to) return false;
    return true;
  });
}

export function filterNoticesByDateRange(
  notices: NoticeItem[],
  from?: string,
  to?: string,
): NoticeItem[] {
  return notices.filter((n) => {
    const date = extractDateKST(n.created);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

export function extractDateKST(isoDatetime: string): string {
  return dayjs(isoDatetime).tz('Asia/Seoul').format('YYYY-MM-DD');
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
