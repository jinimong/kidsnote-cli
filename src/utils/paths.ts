import { homedir } from 'node:os';
import { join } from 'node:path';

const INSTALL_DIR = join(homedir(), '.kidsnote');

export function getInstallDir(): string {
  return INSTALL_DIR;
}

export function getDataDir(): string {
  return join(INSTALL_DIR, 'data');
}

export function getCacheBaseDir(): string {
  return join(INSTALL_DIR, 'cache');
}

export function getPluginsDir(): string {
  return join(INSTALL_DIR, 'plugins');
}
