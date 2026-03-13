import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockClearAll = vi.fn();
const mockLoadSession = vi.fn();
const mockSaveCredentials = vi.fn();
const mockLoadCredentials = vi.fn();

vi.mock('../../src/auth/index.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  clearAll: (...args: unknown[]) => mockClearAll(...args),
  loadSession: (...args: unknown[]) => mockLoadSession(...args),
  saveCredentials: (...args: unknown[]) => mockSaveCredentials(...args),
  loadCredentials: (...args: unknown[]) => mockLoadCredentials(...args),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

const mockPromptText = vi.fn();
const mockPromptPassword = vi.fn();
const mockPromptConfirm = vi.fn();

vi.mock('../../src/utils/prompt.js', () => ({
  promptText: (...args: unknown[]) => mockPromptText(...args),
  promptPassword: (...args: unknown[]) => mockPromptPassword(...args),
  promptConfirm: (...args: unknown[]) => mockPromptConfirm(...args),
}));

const { Command } = await import('commander');
const { registerLoginCommand } = await import('../../src/commands/login.js');

function captureStdout(): { getOutput: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  });
  return {
    getOutput: () => chunks.join(''),
    restore: () => spy.mockRestore(),
  };
}

function captureStderr(): { getOutput: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  });
  return {
    getOutput: () => chunks.join(''),
    restore: () => spy.mockRestore(),
  };
}

describe('login command', () => {
  let savedExitCode: number | string | undefined;

  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockClearAll.mockReset();
    mockLoadSession.mockReset();
    mockSaveCredentials.mockReset();
    mockLoadCredentials.mockReset();
    mockPromptText.mockReset();
    mockPromptPassword.mockReset();
    mockPromptConfirm.mockReset();
    savedExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
  });

  async function runLogin(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    const program = new Command();
    program.exitOverride();
    registerLoginCommand(program);
    const out = captureStdout();
    const err = captureStderr();
    try {
      await program.parseAsync(['node', 'kidsnote', 'login', ...args]);
    } finally {
      out.restore();
      err.restore();
    }
    return { stdout: out.getOutput(), stderr: err.getOutput() };
  }

  it('--status: 세션이 있으면 인증 상태를 출력한다', async () => {
    const now = Date.now();
    mockLoadSession.mockResolvedValue({
      cookie: 'c',
      childId: 42,
      centerId: 10,
      savedAt: now,
    });

    const { stdout } = await runLogin('--status');
    const parsed = JSON.parse(stdout);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.childId).toBe(42);
    expect(parsed.centerId).toBe(10);
    expect(parsed.savedAt).toBe(new Date(now).toISOString());
  });

  it('--status: 세션이 없으면 미인증 상태를 출력한다', async () => {
    mockLoadSession.mockResolvedValue(null);

    const { stdout } = await runLogin('--status');
    expect(JSON.parse(stdout)).toEqual({ authenticated: false });
  });

  // logout is a separate command now; tested in logout-command.test.ts

  it('-u/-p: 비대화형 모드로 인증하고 자동으로 키체인에 저장한다', async () => {
    mockAuthenticate.mockResolvedValue({
      cookie: 'new=cookie',
      childId: 5,
      fromCache: false,
    });

    const { stdout } = await runLogin('-u', 'user@test.com', '-p', 'secret');
    expect(mockAuthenticate).toHaveBeenCalledWith({
      username: 'user@test.com',
      password: 'secret',
      forceRefresh: true,
    });
    expect(mockSaveCredentials).toHaveBeenCalledWith({
      username: 'user@test.com',
    });
    expect(mockPromptText).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe('login');
  });

  it('대화형 모드: 프롬프트를 통해 인증하고 저장 여부를 물어본다', async () => {
    mockLoadCredentials.mockReturnValue({ username: 'saved@test.com' });
    mockPromptText.mockResolvedValue('saved@test.com');
    mockPromptPassword.mockResolvedValue('newpass');
    mockAuthenticate.mockResolvedValue({ cookie: 'c', childId: 1, fromCache: false });
    mockPromptConfirm.mockResolvedValue(true);

    const { stdout } = await runLogin();
    expect(mockPromptText).toHaveBeenCalledWith('아이디', 'saved@test.com');
    expect(mockPromptPassword).toHaveBeenCalledWith('비밀번호');
    expect(mockAuthenticate).toHaveBeenCalledWith({
      username: 'saved@test.com',
      password: 'newpass',
      forceRefresh: true,
    });
    // New policy: do not prompt; always save username
    expect(mockPromptConfirm).not.toHaveBeenCalled();
    expect(mockSaveCredentials).toHaveBeenCalledWith({
      username: 'saved@test.com',
    });
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
  });

  it('대화형 모드: 저장을 거부하면 키체인에 저장하지 않는다', async () => {
    mockLoadCredentials.mockReturnValue(null);
    mockPromptText.mockResolvedValue('user@test.com');
    mockPromptPassword.mockResolvedValue('pass');
    mockAuthenticate.mockResolvedValue({ cookie: 'c', fromCache: false });
    mockPromptConfirm.mockResolvedValue(false);

    await runLogin();
    // New policy: do not prompt; always save username
    expect(mockPromptConfirm).not.toHaveBeenCalled();
    expect(mockSaveCredentials).toHaveBeenCalled();
  });

  it('대화형 모드: 저장된 자격증명이 없으면 기본값 없이 프롬프트한다', async () => {
    mockLoadCredentials.mockReturnValue(null);
    mockPromptText.mockResolvedValue('new@test.com');
    mockPromptPassword.mockResolvedValue('pass');
    mockAuthenticate.mockResolvedValue({ cookie: 'c', fromCache: false });
    mockPromptConfirm.mockResolvedValue(false);

    await runLogin();
    expect(mockPromptText).toHaveBeenCalledWith('아이디', undefined);
  });

  it('인증 실패 시 에러 JSON을 stderr로 출력한다', async () => {
    mockLoadCredentials.mockReturnValue(null);
    mockPromptText.mockResolvedValue('user@test.com');
    mockPromptPassword.mockResolvedValue('wrong');
    mockAuthenticate.mockRejectedValue(new Error('로그인 실패'));

    const { stderr } = await runLogin();
    const parsed = JSON.parse(stderr);
    expect(parsed.error).toContain('로그인 실패');
    expect(process.exitCode).toBe(1);
  });
});
