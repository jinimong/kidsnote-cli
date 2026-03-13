import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testPluginsDir = join(tmpdir(), `kidsnote-test-plugins-${Date.now()}`);

vi.mock('../../src/utils/paths.js', () => ({
  getInstallDir: () => join(tmpdir(), 'kidsnote-test'),
  getDataDir: () => join(tmpdir(), 'kidsnote-test', 'data'),
  getCacheBaseDir: () => join(tmpdir(), 'kidsnote-test', 'cache'),
  getPluginsDir: () => testPluginsDir,
}));

const { loadPlugins, getProvider, listPlugins, resetPluginCache } = await import(
  '../../src/plugins/loader.js'
);

describe('loadPlugins', () => {
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

  it('returns empty array when plugins dir does not exist', async () => {
    const plugins = await loadPlugins();
    expect(plugins).toEqual([]);
  });

  it('returns empty array when plugins dir is empty', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    const plugins = await loadPlugins();
    expect(plugins).toEqual([]);
  });

  it('loads a valid plugin', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    const pluginCode = `
			export default {
				name: 'test-plugin',
				version: '1.0.0',
				providers: {
					greet() { return 'hello'; }
				}
			};
		`;
    writeFileSync(join(testPluginsDir, 'test.js'), pluginCode);

    const plugins = await loadPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('test-plugin');
    expect(plugins[0].version).toBe('1.0.0');
  });

  it('loads plugin without providers', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'minimal.js'),
      'export default { name: "minimal", version: "1.0.0" };',
    );

    const plugins = await loadPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].providers).toBeUndefined();
  });

  it('ignores files without name or version', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(join(testPluginsDir, 'bad.js'), 'export default { foo: "bar" };');

    const plugins = await loadPlugins();
    expect(plugins).toEqual([]);
  });

  it('ignores non-js files', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(join(testPluginsDir, 'readme.txt'), 'not a plugin');

    const plugins = await loadPlugins();
    expect(plugins).toEqual([]);
  });

  it('ignores plugins that fail to load', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(join(testPluginsDir, 'broken.js'), 'throw new Error("broken");');

    const plugins = await loadPlugins();
    expect(plugins).toEqual([]);
  });

  it('caches loaded plugins on second call', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'cached.js'),
      'export default { name: "cached", version: "1.0.0" };',
    );

    const first = await loadPlugins();
    const second = await loadPlugins();
    expect(first).toBe(second);
  });
});

describe('getProvider', () => {
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

  it('returns null when no plugins exist', async () => {
    const fn = await getProvider('fetchReports');
    expect(fn).toBeNull();
  });

  it('returns null when no plugin provides the function', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'empty.js'),
      'export default { name: "empty", version: "1.0.0" };',
    );

    const fn = await getProvider('fetchReports');
    expect(fn).toBeNull();
  });

  it('returns provider function from plugin', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    const code = `
			export default {
				name: 'custom',
				version: '1.0.0',
				providers: {
					greet(name) { return 'hello ' + name; }
				}
			};
		`;
    writeFileSync(join(testPluginsDir, 'custom.js'), code);

    const greet = await getProvider('greet');
    expect(greet).not.toBeNull();
    expect(greet!('world')).toBe('hello world');
  });

  it('returns first matching provider when multiple plugins exist', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'a-first.js'),
      `export default {
				name: 'first',
				version: '1.0.0',
				providers: { compute() { return 'first'; } }
			};`,
    );
    writeFileSync(
      join(testPluginsDir, 'b-second.js'),
      `export default {
				name: 'second',
				version: '1.0.0',
				providers: { compute() { return 'second'; } }
			};`,
    );

    const compute = await getProvider('compute');
    expect(compute).not.toBeNull();
    expect(compute!()).toBe('first');
  });

  it('skips plugin without providers and finds next', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'a-noproviders.js'),
      'export default { name: "noproviders", version: "1.0.0" };',
    );
    writeFileSync(
      join(testPluginsDir, 'b-hasprovider.js'),
      `export default {
				name: 'hasprovider',
				version: '1.0.0',
				providers: { doStuff() { return 42; } }
			};`,
    );

    const doStuff = await getProvider('doStuff');
    expect(doStuff).not.toBeNull();
    expect(doStuff!()).toBe(42);
  });
});

describe('listPlugins', () => {
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

  it('returns same result as loadPlugins', async () => {
    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'list.js'),
      'export default { name: "listed", version: "2.0.0" };',
    );

    const listed = await listPlugins();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('listed');
  });
});

describe('resetPluginCache', () => {
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

  it('forces reload on next loadPlugins call', async () => {
    const first = await loadPlugins();
    expect(first).toEqual([]);

    mkdirSync(testPluginsDir, { recursive: true });
    writeFileSync(
      join(testPluginsDir, 'new.js'),
      'export default { name: "new", version: "1.0.0" };',
    );

    resetPluginCache();
    const second = await loadPlugins();
    expect(second).toHaveLength(1);
  });
});
