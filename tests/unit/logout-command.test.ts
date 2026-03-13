import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClearAll = vi.fn();

vi.mock('../../src/auth/index.js', () => ({
  clearAll: (...args: unknown[]) => mockClearAll(...args),
}));

const { registerLogoutCommand } = await import('../../src/commands/logout.js');

describe('logout command', () => {
  beforeEach(() => {
    mockClearAll.mockReset();
  });

  async function runLogout(...args: string[]) {
    const program = new Command();
    program.exitOverride();
    registerLogoutCommand(program);
    try {
      await program.parseAsync(['node', 'kidsnote', 'logout', ...args]);
    } catch {}
  }

  it('calls clearAll and prints success', async () => {
    mockClearAll.mockResolvedValue(undefined);
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runLogout();
    expect(mockClearAll).toHaveBeenCalled();
    outSpy.mockRestore();
  });
});
