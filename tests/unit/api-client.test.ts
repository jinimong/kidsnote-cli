import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockDeleteSession = vi.fn().mockResolvedValue(true);
vi.mock('../../src/auth/session-store.js', () => ({
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
}));

const { fetchReports, fetchNotices, discoverIdsViaApi } = await import(
  '../../src/scraper/api-client.js'
);

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as Response;
}

describe('fetchReports', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDeleteSession.mockReset().mockResolvedValue(true);
  });

  it('fetches reports with correct URL params', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, date_written: '2026-03-14', content: 'test' }],
      }),
    );

    const results = await fetchReports({
      cookie: 'session=abc',
      childId: 42,
      from: '2026-03-10',
      to: '2026-03-14',
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/api/v1_2/children/42/reports/');
    expect(calledUrl.searchParams.get('tz')).toBe('Asia/Seoul');
    expect(mockFetch.mock.calls[0][1].headers.Cookie).toBe('session=abc');
  });

  it('handles pagination', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: 'cD0yMDI1LTA3LTIyKzA1JTNBMTElM0EwNy4wNDA3NDMlMkIwMCUzQTAw',
          previous: null,
          results: [{ id: 1 }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: null,
          previous: 'prev-cursor',
          results: [{ id: 2 }],
        }),
      );

    const results = await fetchReports({
      cookie: 'c',
      childId: 42,
    });

    expect(results).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const secondUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(secondUrl.searchParams.get('cursor')).toBe(
      'cD0yMDI1LTA3LTIyKzA1JTNBMTElM0EwNy4wNDA3NDMlMkIwMCUzQTAw',
    );
  });

  it('throws on 401 with re-login message', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 401));

    await expect(fetchReports({ cookie: 'expired', childId: 1 })).rejects.toThrow(
      '인증이 만료되었습니다',
    );
  });

  it('deletes session on 401 before throwing', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 401));

    await expect(fetchReports({ cookie: 'expired', childId: 1 })).rejects.toThrow();
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it('deletes session on 403 before throwing', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 403));

    await expect(fetchReports({ cookie: 'forbidden', childId: 1 })).rejects.toThrow(
      '인증이 만료되었습니다',
    );
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(fetchReports({ cookie: 'c', childId: 1 })).rejects.toThrow('HTTP 500');
  });

  it('stops paginating when oldest result is before from date', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        count: 0,
        next: 'cursor-page2',
        previous: null,
        results: [
          { id: 1, date_written: '2026-03-14' },
          { id: 2, date_written: '2026-03-10' },
        ],
      }),
    );

    const results = await fetchReports({
      cookie: 'c',
      childId: 42,
      from: '2026-03-12',
    });

    expect(results).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchNotices', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDeleteSession.mockReset().mockResolvedValue(true);
  });

  it('fetches notices with correct URL using centerId', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 10, title: 'Notice' }],
      }),
    );

    const results = await fetchNotices({ cookie: 'c', centerId: 85962 });
    expect(results).toHaveLength(1);

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/api/v1/centers/85962/notices/');
    expect(calledUrl.searchParams.get('tz')).toBe('Asia/Seoul');
    expect(calledUrl.searchParams.has('cls')).toBe(false);
  });

  it('appends cls query param when classId is provided', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 10, title: 'Center Notice', is_center_notice: true, cls: null },
          { id: 11, title: 'Class Notice', is_center_notice: false, cls: 958174 },
        ],
      }),
    );

    const results = await fetchNotices({ cookie: 'c', centerId: 85962, classId: 958174 });
    expect(results).toHaveLength(2);

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('cls')).toBe('958174');
  });
});

describe('discoverIdsViaApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDeleteSession.mockReset().mockResolvedValue(true);
  });

  it('returns childId and centerId from children endpoint', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [{ id: 123, enrollment: [{ child_id: 123, center_id: 456 }] }],
      }),
    );

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids).toEqual({ childId: 123, centerId: 456 });

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/api/v1/me/children/');
  });

  it('returns classId from enrollment belong_to_class field', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [
          { id: 123, enrollment: [{ child_id: 123, center_id: 456, belong_to_class: 958174 }] },
        ],
      }),
    );

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids).toEqual({ childId: 123, centerId: 456, classId: 958174 });
  });

  it('returns classId undefined when enrollment has no belong_to_class', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [{ id: 123, enrollment: [{ child_id: 123, center_id: 456 }] }],
      }),
    );

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids?.classId).toBeUndefined();
  });

  it('returns classId undefined when enrollment is missing', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [{ id: 123 }],
      }),
    );

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids).toEqual({ childId: 123, centerId: undefined, classId: undefined });
  });

  it('returns null when no children found', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const ids = await discoverIdsViaApi('session=abc');
    expect(ids).toBeNull();
  });
});
