import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDataDir } from '../utils/paths.js';

const CREDENTIAL_FILE = 'credentials.json';
const SESSION_KEY_FILE = 'session.key';
const SESSION_FILE = 'session.enc';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export interface StoredCredentials {
  username: string;
}

export interface StoredSession {
  cookie: string;
  childId?: number;
  centerId?: number;
  savedAt: number;
  expiresAt?: number;
}

function encrypt(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(data: Buffer, key: Buffer): string {
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function saveCredentials(creds: StoredCredentials): void {
  const dataDir = getDataDir();
  const filePath = join(dataDir, CREDENTIAL_FILE);
  try {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    writeFileSync(filePath, JSON.stringify({ username: creds.username }), { mode: 0o600 });
  } catch (e) {
    process.stderr.write(
      `[경고] 자격증명 저장 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }
}

export function loadCredentials(): StoredCredentials | null {
  try {
    const filePath = join(getDataDir(), CREDENTIAL_FILE);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    if (!raw) return null;
    return JSON.parse(raw) as StoredCredentials;
  } catch (e) {
    process.stderr.write(
      `[경고] 자격증명 로드 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return null;
  }
}

export function deleteCredentials(): boolean {
  try {
    const filePath = join(getDataDir(), CREDENTIAL_FILE);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    process.stderr.write(
      `[경고] 자격증명 삭제 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return false;
  }
}

function getOrCreateSessionKey(): Buffer {
  const keyPath = join(getDataDir(), SESSION_KEY_FILE);
  try {
    if (existsSync(keyPath)) {
      const raw = readFileSync(keyPath, 'utf8');
      return Buffer.from(raw.trim(), 'hex');
    }
  } catch (e) {
    process.stderr.write(
      `[경고] 세션 키 로드 실패, 새로 생성합니다: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }

  const key = randomBytes(32);
  try {
    mkdirSync(getDataDir(), { recursive: true, mode: 0o700 });
    writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  } catch (e) {
    process.stderr.write(
      `[경고] 세션 키 저장 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }
  return key;
}

export async function saveSession(session: Omit<StoredSession, 'savedAt'>): Promise<void> {
  const dataDir = getDataDir();
  await mkdir(dataDir, { recursive: true, mode: 0o700 });

  const stored: StoredSession = {
    ...session,
    savedAt: Date.now(),
  };

  const key = getOrCreateSessionKey();
  const encrypted = encrypt(JSON.stringify(stored), key);
  await writeFile(join(dataDir, SESSION_FILE), encrypted, { mode: 0o600 });
}

export async function loadSession(): Promise<StoredSession | null> {
  const filePath = join(getDataDir(), SESSION_FILE);

  let raw: Buffer;
  try {
    raw = await readFile(filePath);
  } catch {
    return null;
  }

  let key: Buffer;
  try {
    key = getOrCreateSessionKey();
  } catch (e) {
    process.stderr.write(
      `[경고] 세션 복호화 키 로드 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return null;
  }

  let session: StoredSession;
  try {
    const decrypted = decrypt(raw, key);
    session = JSON.parse(decrypted) as StoredSession;
  } catch (e) {
    process.stderr.write(
      `[경고] 세션 복호화 실패, 손상된 세션을 삭제합니다: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    await rm(filePath, { force: true });
    return null;
  }

  if (session.expiresAt && Date.now() >= session.expiresAt) {
    process.stderr.write('[정보] 세션이 만료되었습니다. 재로그인이 필요합니다.\n');
    await rm(filePath, { force: true });
    return null;
  }

  return session;
}

export async function deleteSession(): Promise<boolean> {
  const filePath = join(getDataDir(), SESSION_FILE);
  try {
    await rm(filePath, { force: true });
    return true;
  } catch (e) {
    process.stderr.write(`[경고] 세션 삭제 실패: ${e instanceof Error ? e.message : String(e)}\n`);
    return false;
  }
}

export async function clearAll(): Promise<void> {
  deleteCredentials();
  await deleteSession();
  try {
    const keyPath = join(getDataDir(), SESSION_KEY_FILE);
    if (existsSync(keyPath)) unlinkSync(keyPath);
  } catch (e) {
    process.stderr.write(
      `[경고] 세션 키 삭제 실패: ${e instanceof Error ? e.message : String(e)}\n`,
    );
  }
}
