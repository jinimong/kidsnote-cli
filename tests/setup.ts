import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.TZ = 'Asia/Seoul';
});
