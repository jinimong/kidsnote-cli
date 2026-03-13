import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/paths.js', () => ({
  getDataDir: () => '/tmp/kidsnote-cli-test-auth-data',
  getCacheBaseDir: () => '/tmp/kidsnote-cli-test-auth-cache',
}));

const mockRestLogin = vi.fn();
class MockRestAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RestAuthError';
  }
}
vi.mock('../../src/auth/rest-api-auth.js', () => ({
  loginWithRestApi: (...args: unknown[]) => mockRestLogin(...args),
  RestAuthError: MockRestAuthError,
}));

const mockPlaywrightLogin = vi.fn();
vi.mock('../../src/auth/playwright-auth.js', () => ({
  loginWithPlaywright: (...args: unknown[]) => mockPlaywrightLogin(...args),
}));

const { authenticate, AuthError } = await import('../../src/auth/authenticate.js');
const { saveSession, loadSession, saveCredentials } = await import(
  '../../src/auth/session-store.js'
);

const TEST_DATA_DIR = '/tmp/kidsnote-cli-test-auth-data';

describe('authenticate', () => {
  beforeEach(() => {
    // ensure no leftover files
    // tests will clean data dir in afterEach
    mockRestLogin.mockReset();
    mockPlaywrightLogin.mockReset();
    delete process.env.KIDSNOTE_USERNAME;
    delete process.env.KIDSNOTE_PASSWORD;
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('returns cached session when available', async () => {
    await saveSession({ cookie: 'cached=yes', childId: 42 });

    const result = await authenticate();
    expect(result.cookie).toBe('cached=yes');
    expect(result.childId).toBe(42);
    expect(result.fromCache).toBe(true);
    expect(mockRestLogin).not.toHaveBeenCalled();
  });

  it('skips cache when forceRefresh is true', async () => {
    await saveSession({ cookie: 'cached=yes' });
    process.env.KIDSNOTE_USERNAME = 'user';
    process.env.KIDSNOTE_PASSWORD = 'pass';
    mockRestLogin.mockResolvedValue({ cookie: 'fresh=yes' });

    const result = await authenticate({ forceRefresh: true });
    expect(result.cookie).toBe('fresh=yes');
    expect(result.fromCache).toBe(false);
    expect(mockRestLogin).toHaveBeenCalledWith('user', 'pass');
  });

  it('tries REST API first', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    mockRestLogin.mockResolvedValue({ cookie: 'rest=cookie' });

    const result = await authenticate();
    expect(result.cookie).toBe('rest=cookie');
    expect(result.fromCache).toBe(false);
    expect(mockPlaywrightLogin).not.toHaveBeenCalled();
  });

  it('falls back to Playwright when REST fails with non-auth error', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    mockRestLogin.mockRejectedValue(new Error('REST failed'));
    mockPlaywrightLogin.mockResolvedValue({ cookie: 'pw=cookie', childId: 99 });

    const result = await authenticate();
    expect(result.cookie).toBe('pw=cookie');
    expect(result.childId).toBe(99);
    expect(mockRestLogin).toHaveBeenCalled();
    expect(mockPlaywrightLogin).toHaveBeenCalled();
  });

  it('skips Playwright fallback when REST returns 4xx auth error', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    mockRestLogin.mockRejectedValue(new MockRestAuthError('HTTP 400', 400));

    await expect(authenticate()).rejects.toThrow(AuthError);
    await expect(authenticate()).rejects.toThrow('로그인에 실패했습니다');
    expect(mockPlaywrightLogin).not.toHaveBeenCalled();
  });

  it('throws AuthError when all methods fail', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    mockRestLogin.mockRejectedValue(new Error('REST fail'));
    mockPlaywrightLogin.mockRejectedValue(new Error('PW fail'));

    await expect(authenticate()).rejects.toThrow(AuthError);
    await expect(authenticate()).rejects.toThrow('모든 로그인 방법이 실패했습니다');
  });

  it('saves session after successful login', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    mockRestLogin.mockResolvedValue({ cookie: 'saved=yes' });

    await authenticate();
    const session = await loadSession();
    expect(session).not.toBeNull();
    expect(session?.cookie).toBe('saved=yes');
  });

  it('saves expiresAt from REST login result', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    const futureMs = Date.now() + 3600_000;
    mockRestLogin.mockResolvedValue({ cookie: 'c', expiresAt: futureMs });

    await authenticate();
    const session = await loadSession();
    expect(session?.expiresAt).toBe(futureMs);
  });

  it('saves expiresAt from Playwright login result', async () => {
    process.env.KIDSNOTE_USERNAME = 'u';
    process.env.KIDSNOTE_PASSWORD = 'p';
    const futureMs = Date.now() + 3600_000;
    mockRestLogin.mockRejectedValue(new Error('REST fail'));
    mockPlaywrightLogin.mockResolvedValue({ cookie: 'pw', childId: 1, expiresAt: futureMs });

    await authenticate();
    const session = await loadSession();
    expect(session?.expiresAt).toBe(futureMs);
  });

  it('uses explicit username/password over env vars', async () => {
    process.env.KIDSNOTE_USERNAME = 'env_user';
    process.env.KIDSNOTE_PASSWORD = 'env_pass';
    mockRestLogin.mockResolvedValue({ cookie: 'c' });

    await authenticate({ username: 'explicit_user', password: 'explicit_pass' });
    expect(mockRestLogin).toHaveBeenCalledWith('explicit_user', 'explicit_pass');
  });

  it('uses stored credentials before env vars', async () => {
    saveCredentials({ username: 'stored_user' });
    process.env.KIDSNOTE_USERNAME = 'env_user';
    process.env.KIDSNOTE_PASSWORD = 'env_pass';
    mockRestLogin.mockResolvedValue({ cookie: 'c' });

    await authenticate();
    expect(mockRestLogin).toHaveBeenCalledWith('stored_user', 'env_pass');
  });

  it('uses env vars when no stored credentials', async () => {
    process.env.KIDSNOTE_USERNAME = 'env_user';
    process.env.KIDSNOTE_PASSWORD = 'env_pass';
    mockRestLogin.mockResolvedValue({ cookie: 'c' });

    await authenticate();
    expect(mockRestLogin).toHaveBeenCalledWith('env_user', 'env_pass');
  });

  it('throws AuthError when no credentials available', async () => {
    await expect(authenticate()).rejects.toThrow(AuthError);
    await expect(authenticate()).rejects.toThrow('자격증명을 찾을 수 없습니다');
  });
});
