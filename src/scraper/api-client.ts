import { deleteSession } from '../auth/session-store.js';
import { getProvider } from '../plugins/loader.js';
import type { NoticeItem, NoticesApiResponse, ReportItem, ReportsApiResponse } from '../types.js';

const BASE_URL = 'https://www.kidsnote.com';
const DEFAULT_PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 500;

export interface FetchReportsOptions {
  cookie: string;
  childId: number;
  from?: string;
  to?: string;
}

export interface FetchNoticesOptions {
  cookie: string;
  centerId: number;
  classId?: number;
}

interface Enrollment {
  child_id: number;
  center_id: number;
  belong_to_class?: number;
}

interface ChildWithEnrollment {
  id: number;
  enrollment?: Enrollment[];
}

interface ChildrenResponse {
  results?: ChildWithEnrollment[];
}

export interface DiscoveredIds {
  childId: number;
  centerId?: number;
  classId?: number;
}

async function fetchWithCookie<T>(url: string, cookie: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Cookie: cookie },
  });

  if (res.status === 401 || res.status === 403) {
    await deleteSession();
    throw new Error(`인증이 만료되었습니다 (HTTP ${res.status}). 재로그인이 필요합니다.`);
  }

  if (!res.ok) {
    throw new Error(`API 요청 실패: HTTP ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverIdsViaApi(cookie: string): Promise<DiscoveredIds | null> {
  try {
    const data = await fetchWithCookie<ChildrenResponse>(
      `${BASE_URL}/api/v1/me/children/?page_size=10`,
      cookie,
    );
    if (data.results && data.results.length > 0) {
      const child = data.results[0];
      const enrollment = child.enrollment?.[0];
      return {
        childId: child.id,
        centerId: enrollment?.center_id,
        classId: enrollment?.belong_to_class,
      };
    }
  } catch (e) {
    process.stderr.write(
      `[경고] API를 통한 아이 정보 탐색 실패, 브라우저 탐색으로 대체합니다: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }

  return null;
}

export async function fetchReports(opts: FetchReportsOptions): Promise<ReportItem[]> {
  const customImpl = await getProvider<typeof fetchReports>('fetchReports');
  if (customImpl) return customImpl(opts);

  const url = new URL(`/api/v1_2/children/${opts.childId}/reports/`, BASE_URL);
  url.searchParams.set('page_size', String(DEFAULT_PAGE_SIZE));
  url.searchParams.set('tz', 'Asia/Seoul');

  const allResults: ReportItem[] = [];
  let cursor: string | null = null;

  do {
    const reqUrl = new URL(url.toString());
    if (cursor) reqUrl.searchParams.set('cursor', cursor);

    const data: ReportsApiResponse = await fetchWithCookie<ReportsApiResponse>(
      reqUrl.toString(),
      opts.cookie,
    );
    allResults.push(...data.results);

    if (opts.from && data.results.length > 0) {
      const oldestInPage = data.results[data.results.length - 1].date_written;
      if (oldestInPage < opts.from) break;
    }

    cursor = data.next;
    if (cursor) await delay(REQUEST_DELAY_MS);
  } while (cursor);

  return allResults;
}

export async function fetchNotices(opts: FetchNoticesOptions): Promise<NoticeItem[]> {
  const customImpl = await getProvider<typeof fetchNotices>('fetchNotices');
  if (customImpl) return customImpl(opts);

  const url = new URL(`/api/v1/centers/${opts.centerId}/notices/`, BASE_URL);
  url.searchParams.set('page_size', String(DEFAULT_PAGE_SIZE));
  url.searchParams.set('tz', 'Asia/Seoul');
  if (opts.classId) {
    url.searchParams.set('cls', String(opts.classId));
  }

  const allResults: NoticeItem[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = 20;
  let pageCount = 0;

  do {
    const reqUrl = new URL(url.toString());
    if (cursor) reqUrl.searchParams.set('cursor', cursor);

    const data: NoticesApiResponse = await fetchWithCookie<NoticesApiResponse>(
      reqUrl.toString(),
      opts.cookie,
    );
    allResults.push(...data.results);
    pageCount++;

    cursor = data.next;
    if (cursor && pageCount < MAX_PAGES) await delay(REQUEST_DELAY_MS);
  } while (cursor && pageCount < MAX_PAGES);

  return allResults;
}
