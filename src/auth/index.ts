export type { AuthResult } from './authenticate.js';
export { AuthError, authenticate } from './authenticate.js';
export type { PlaywrightLoginResult } from './playwright-auth.js';
export { loginWithPlaywright } from './playwright-auth.js';
export type { RestLoginResult } from './rest-api-auth.js';
export { loginWithRestApi } from './rest-api-auth.js';
export type { StoredCredentials, StoredSession } from './session-store.js';
export {
  clearAll,
  deleteCredentials,
  deleteSession,
  loadCredentials,
  loadSession,
  saveCredentials,
  saveSession,
} from './session-store.js';
