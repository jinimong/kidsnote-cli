import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const { handleUpdate } = await import('../../src/commands/update.js');

function captureStdout(): { getOutput: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  });
  return { getOutput: () => chunks.join(''), restore: () => spy.mockRestore() };
}

function setupExecFile(responses: Record<string, string>) {
  mockExecFile.mockImplementation(
    (
      cmd: string,
      args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const key = `${cmd} ${args.join(' ')}`;
      for (const [pattern, response] of Object.entries(responses)) {
        if (key.includes(pattern)) {
          cb(null, response, '');
          return;
        }
      }
      cb(null, '', '');
    },
  );
}

describe('update command', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    mockReadFile.mockReset();
  });

  it('reports already up to date when local matches remote', async () => {
    const sha = 'abc123def456';
    mockReadFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));
    setupExecFile({
      fetch: '',
      'rev-parse HEAD': sha,
      'rev-parse origin/main': sha,
    });

    const out = captureStdout();
    try {
      await handleUpdate();
    } finally {
      out.restore();
    }

    const parsed = JSON.parse(out.getOutput());
    expect(parsed.ok).toBe(true);
    expect(parsed.updated).toBe(false);
    expect(parsed.version).toBe('1.0.0');
  });

  it('updates when local differs from remote', async () => {
    let readCount = 0;
    mockReadFile.mockImplementation(() => {
      readCount++;
      const version = readCount === 1 ? '1.0.0' : '1.1.0';
      return Promise.resolve(JSON.stringify({ version }));
    });

    setupExecFile({
      fetch: '',
      'rev-parse HEAD': 'aaa111',
      'rev-parse origin/main': 'bbb222',
      reset: '',
      install: '',
    });

    const out = captureStdout();
    try {
      await handleUpdate();
    } finally {
      out.restore();
    }

    const parsed = JSON.parse(out.getOutput());
    expect(parsed.ok).toBe(true);
    expect(parsed.updated).toBe(true);
    expect(parsed.previousVersion).toBe('1.0.0');
    expect(parsed.version).toBe('1.1.0');
  });

  it('throws when git command fails', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error('network error'), '', 'fatal: unable to access');
      },
    );

    await expect(handleUpdate()).rejects.toThrow();
  });
});
