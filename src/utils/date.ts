import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TZ = 'Asia/Seoul';

export interface DateRangeOpts {
  from?: string;
  to?: string;
  today?: boolean;
  thisWeek?: boolean;
}

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateRangeError';
  }
}

export function validateDateFormat(value: string, label: string): void {
  const isPatternMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dayjs(value, 'YYYY-MM-DD', true);
  if (!isPatternMatch || !parsed.isValid()) {
    throw new DateRangeError(`${label} 날짜 형식이 올바르지 않습니다: "${value}" (YYYY-MM-DD)`);
  }
}

export function resolveDateRange(
  opts: DateRangeOpts,
  options: { requireDate?: boolean } = {},
): { from?: string; to?: string } {
  const requireDate = options.requireDate ?? true;
  const exclusiveCount = [Boolean(opts.from || opts.to), opts.today, opts.thisWeek].filter(
    Boolean,
  ).length;

  if (exclusiveCount > 1) {
    throw new DateRangeError('--from/--to, --today, --this-week 는 동시에 사용할 수 없습니다.');
  }

  if (exclusiveCount === 0) {
    if (requireDate) {
      throw new DateRangeError(
        '날짜 범위를 지정해주세요: --from/--to, --today, --this-week 중 하나',
      );
    }
    return {};
  }

  const now = dayjs().tz(TZ);
  const today = now.format('YYYY-MM-DD');

  if (opts.today) {
    return { from: today, to: today };
  }

  if (opts.thisWeek) {
    const dayOfWeek = now.day();
    const monday = dayOfWeek === 0 ? now.subtract(6, 'day') : now.day(1);
    return { from: monday.format('YYYY-MM-DD'), to: today };
  }

  if (opts.from) {
    validateDateFormat(opts.from, '--from');
  }
  if (opts.to) {
    validateDateFormat(opts.to, '--to');
  }

  if (!opts.from || !opts.to) {
    throw new DateRangeError('--from 과 --to 를 모두 지정해주세요.');
  }

  return { from: opts.from, to: opts.to };
}
