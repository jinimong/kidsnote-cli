import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { describe, expect, it } from 'vitest';
import { DateRangeError, resolveDateRange, validateDateFormat } from '../../src/utils/date.js';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('resolveDateRange', () => {
  it('returns today range for --today', () => {
    const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
    expect(resolveDateRange({ today: true })).toEqual({ from: today, to: today });
  });

  it('returns monday to today range for --this-week', () => {
    const now = dayjs().tz('Asia/Seoul');
    const dayOfWeek = now.day();
    const monday = dayOfWeek === 0 ? now.subtract(6, 'day') : now.day(1);

    expect(resolveDateRange({ thisWeek: true })).toEqual({
      from: monday.format('YYYY-MM-DD'),
      to: now.format('YYYY-MM-DD'),
    });
  });

  it('returns explicit range for --from/--to', () => {
    expect(resolveDateRange({ from: '2026-03-01', to: '2026-03-05' })).toEqual({
      from: '2026-03-01',
      to: '2026-03-05',
    });
  });

  it('rejects mutually exclusive options', () => {
    expect(() => resolveDateRange({ today: true, thisWeek: true })).toThrow(DateRangeError);
  });
});

describe('validateDateFormat', () => {
  it('rejects invalid dates', () => {
    expect(() => validateDateFormat('2026-02-30', '--from')).toThrow(DateRangeError);
    expect(() => validateDateFormat('20260301', '--from')).toThrow(DateRangeError);
  });
});
