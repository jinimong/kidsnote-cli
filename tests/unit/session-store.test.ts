import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/paths.js', () => ({
  getDataDir: () => '/tmp/kidsnote-cli-test-data',
  getCacheBaseDir: () => '/tmp/kidsnote-cli-test-cache',
}));

const {
  saveCredentials,
  loadCredentials,
  deleteCredentials,
  saveSession,
  loadSession,
  deleteSession,
  clearAll,
} = await import('../../src/auth/session-store.js');

const TEST_DATA_DIR = '/tmp/kidsnote-cli-test-data';

describe('credential operations', () => {
  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('saves and loads credentials (username-only policy)', () => {
    saveCredentials({ username: 'user@test.com' });
    const loaded = loadCredentials();
    expect(loaded).toEqual({ username: 'user@test.com' });
  });

  it('returns null when no credentials stored', () => {
    expect(loadCredentials()).toBeNull();
  });

  it('deletes credentials', () => {
    saveCredentials({ username: 'u' });
    expect(deleteCredentials()).toBe(true);
    expect(loadCredentials()).toBeNull();
  });

  it('returns false when deleting non-existent credentials', () => {
    expect(deleteCredentials()).toBe(false);
  });
});

describe('session operations', () => {
  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('saves and loads a session with encryption', async () => {
    await saveSession({ cookie: 'sessionid=abc123' });
    const session = await loadSession();
    expect(session).not.toBeNull();
    expect(session?.cookie).toBe('sessionid=abc123');
    expect(session?.savedAt).toBeGreaterThan(0);
  });

  it('stores session file as encrypted binary (not readable plaintext)', async () => {
    await saveSession({ cookie: 'secret-cookie-value' });
    const filePath = join(TEST_DATA_DIR, 'session.enc');
    const raw = await readFile(filePath);
    const asString = raw.toString('utf8');
    expect(asString).not.toContain('secret-cookie-value');
  });

  it('returns null when no session exists', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('loads sessions without expiresAt regardless of age', async () => {
    await saveSession({ cookie: 'old' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const session = await loadSession();
    expect(session).not.toBeNull();
    expect(session?.cookie).toBe('old');
  });

  it('loads sessions when expiresAt is in the future', async () => {
    const futureMs = Date.now() + 60 * 60 * 1000;
    await saveSession({ cookie: 'valid', expiresAt: futureMs });
    const session = await loadSession();
    expect(session).not.toBeNull();
    expect(session?.cookie).toBe('valid');
    expect(session?.expiresAt).toBe(futureMs);
  });

  it('returns null and deletes session when expiresAt is in the past', async () => {
    const pastMs = Date.now() - 1000;
    await saveSession({ cookie: 'expired', expiresAt: pastMs });
    const session = await loadSession();
    expect(session).toBeNull();

    const filePath = join(TEST_DATA_DIR, 'session.enc');
    const exists = await readFile(filePath).then(
      () => true,
      () => false,
    );
    expect(exists).toBe(false);
  });

  it('returns null for corrupted session files', async () => {
    await mkdir(TEST_DATA_DIR, { recursive: true });
    await writeFile(join(TEST_DATA_DIR, 'session.enc'), randomBytes(64));
    expect(await loadSession()).toBeNull();
  });

  it('deletes session', async () => {
    await saveSession({ cookie: 'todelete' });
    expect(await deleteSession()).toBe(true);
    expect(await loadSession()).toBeNull();
  });

  it('saves optional childId and centerId', async () => {
    await saveSession({ cookie: 'c', childId: 123, centerId: 456 });
    const session = await loadSession();
    expect(session?.childId).toBe(123);
    expect(session?.centerId).toBe(456);
  });
});

describe('clearAll', () => {
  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('removes credentials, session, and session key', async () => {
    saveCredentials({ username: 'u' });
    await saveSession({ cookie: 'c' });
    expect(loadCredentials()).not.toBeNull();
    expect(await loadSession()).not.toBeNull();

    await clearAll();

    expect(loadCredentials()).toBeNull();
    expect(await loadSession()).toBeNull();
  });
});
