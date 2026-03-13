import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testPluginsDir = join(tmpdir(), `kidsnote-test-cmd-plugins-${Date.now()}`);

vi.mock('../../src/utils/paths.js', () => ({
  getInstallDir: () => join(tmpdir(), 'kidsnote-test-cmd'),
  getDataDir: () => join(tmpdir(), 'kidsnote-test-cmd', 'data'),
  getCacheBaseDir: () => join(tmpdir(), 'kidsnote-test-cmd', 'cache'),
  getPluginsDir: () => testPluginsDir,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { Command } = await import('commander');
const { registerPluginCommand } = await import('../../src/commands/plugin.js');
const { resetPluginCache } = await import('../../src/plugins/loader.js');

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerPluginCommand(program);
  return program;
}

function captureStdout(): { get: () => string; restore: () => void } {
  let captured = '';
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    captured += String(chunk);
    return true;
  });
  return {
    get: () => captured,
    restore: () => spy.mockRestore(),
  };
}

describe('plugin install', () => {
  beforeEach(() => {
    resetPluginCache();
    mockFetch.mockReset();
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  it('installs plugin from valid invite code', async () => {
    const gistUrl = 'https://gist.githubusercontent.com/user/abc/raw/fast.js';
    const code = Buffer.from(gistUrl).toString('base64');
    const pluginContent = 'export default { name: "fast", version: "1.0.0" };';

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(pluginContent),
    } as Response);

    const output = captureStdout();
    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'install', code]);
    } finally {
      output.restore();
    }

    const result = JSON.parse(output.get());
    expect(result.ok).toBe(true);
    expect(result.action).toBe('plugin.install');
    expect(result.file).toBe('fast.js');

    const installed = readFileSync(join(testPluginsDir, 'fast.js'), 'utf-8');
    expect(installed).toBe(pluginContent);
  });

  it('rejects invalid invite code', async () => {
    const output = captureStdout();
    const stderr: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    });

    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'install', 'not-base64!!!']);
    } finally {
      output.restore();
      stderrSpy.mockRestore();
    }

    const errOutput = stderr.join('');
    expect(errOutput).toContain('유효하지 않은 초대 코드');
  });

  it('rejects code that does not decode to https URL', async () => {
    const code = Buffer.from('http://insecure.com/bad.js').toString('base64');

    const stderr: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    });

    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'install', code]);
    } finally {
      stderrSpy.mockRestore();
    }

    expect(stderr.join('')).toContain('유효하지 않은 초대 코드');
  });
});

describe('plugin list', () => {
  beforeEach(() => {
    resetPluginCache();
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  it('lists installed plugins', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'demo.js'),
      'export default { name: "demo", version: "0.1.0" };',
    );

    const output = captureStdout();
    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'list']);
    } finally {
      output.restore();
    }

    const result = JSON.parse(output.get());
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.plugins[0].name).toBe('demo');
  });

  it('returns empty list when no plugins', async () => {
    const output = captureStdout();
    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'list']);
    } finally {
      output.restore();
    }

    const result = JSON.parse(output.get());
    expect(result.count).toBe(0);
    expect(result.plugins).toEqual([]);
  });
});

describe('plugin remove', () => {
  beforeEach(() => {
    resetPluginCache();
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testPluginsDir)) {
      rmSync(testPluginsDir, { recursive: true });
    }
  });

  it('removes installed plugin', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'removeme.js'),
      'export default { name: "removeme", version: "1.0.0" };',
    );

    const output = captureStdout();
    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'remove', 'removeme']);
    } finally {
      output.restore();
    }

    const result = JSON.parse(output.get());
    expect(result.ok).toBe(true);
    expect(result.removed).toBe('removeme.js');
    expect(existsSync(join(testPluginsDir, 'removeme.js'))).toBe(false);
  });

  it('errors when plugin not found', async () => {
    mkdirSync(testPluginsDir, { recursive: true });

    const stderr: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    });

    try {
      await makeProgram().parseAsync(['node', 'test', 'plugin', 'remove', 'nonexistent']);
    } finally {
      stderrSpy.mockRestore();
    }

    expect(stderr.join('')).toContain('찾을 수 없습니다');
  });
});
