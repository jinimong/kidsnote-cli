import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPluginsDir } from '../utils/paths.js';
import type { KidsnotePlugin, ProviderFn } from './types.js';

let loadedPlugins: KidsnotePlugin[] | null = null;

export async function loadPlugins(): Promise<KidsnotePlugin[]> {
  if (loadedPlugins !== null) return loadedPlugins;

  const dir = getPluginsDir();
  if (!existsSync(dir)) {
    loadedPlugins = [];
    return loadedPlugins;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const plugins: KidsnotePlugin[] = [];

  for (const file of files) {
    try {
      const filePath = join(dir, file);
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);
      const plugin: KidsnotePlugin = mod.default ?? mod;

      if (plugin.name && plugin.version) {
        plugins.push(plugin);
      }
    } catch {
      // 로드 실패 시 무시
    }
  }

  loadedPlugins = plugins;
  return plugins;
}

export async function getProvider<T extends ProviderFn>(name: string): Promise<T | null> {
  const plugins = await loadPlugins();

  for (const plugin of plugins) {
    const fn = plugin.providers?.[name];
    if (typeof fn === 'function') {
      return fn as T;
    }
  }

  return null;
}

export async function listPlugins(): Promise<KidsnotePlugin[]> {
  return loadPlugins();
}

export function resetPluginCache(): void {
  loadedPlugins = null;
}
