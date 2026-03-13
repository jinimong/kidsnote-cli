import { authenticate } from '../auth/index.js';
import { loadSession, saveSession } from '../auth/session-store.js';
import { discoverIdsViaApi } from '../scraper/api-client.js';
import { createBrowserSession, discoverChildId } from '../scraper/browser.js';

export interface ResolvedAuth {
  cookie: string;
  childId: number;
  centerId?: number;
}

export async function resolveAuth(opts?: {
  username?: string;
  password?: string;
}): Promise<ResolvedAuth> {
  const authResult = await authenticate({
    username: opts?.username,
    password: opts?.password,
  });

  let childId = authResult.childId;
  let centerId: number | undefined;

  const session = await loadSession();
  if (!childId) {
    childId = session?.childId;
  }
  if (!centerId) {
    centerId = session?.centerId;
  }

  if (!childId || !centerId) {
    const discovered = await discoverIdsViaApi(authResult.cookie);
    if (discovered) {
      if (!childId) childId = discovered.childId;
      if (!centerId) centerId = discovered.centerId;
    }
  }

  if (!childId) {
    const browserSession = await createBrowserSession(authResult.cookie);
    try {
      childId = await discoverChildId(browserSession);
    } finally {
      await browserSession.close();
    }
  }

  const needsSave =
    (session && (!session.childId || !session.centerId)) || (!session && (childId || centerId));

  if (needsSave && childId) {
    await saveSession({
      cookie: authResult.cookie,
      childId,
      centerId,
    });
  }

  return { cookie: authResult.cookie, childId, centerId };
}
