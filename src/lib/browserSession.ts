export type BrowserSession = { token: string; userId: number; expiresAt: number };

const sessionKey = 'prodesk:browser-session';
export const browserSessionEnded = 'prodesk:browser-session-ended';

export function isBrowserSession(value: unknown): value is BrowserSession {
  if (!value || typeof value !== 'object') return false;
  const { token, userId, expiresAt } = value as Partial<BrowserSession>;
  return typeof token === 'string' && token.length > 0 && token.length <= 4096 &&
    typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0 &&
    typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt) && expiresAt > Date.now();
}

export function readBrowserSession(): BrowserSession | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
    return isBrowserSession(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveBrowserSession(session: BrowserSession) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

export function endBrowserSession(expired = false) {
  try { sessionStorage.removeItem(sessionKey); } catch { /* Storage is blocked. */ }
  window.dispatchEvent(new CustomEvent(browserSessionEnded, { detail: expired }));
}
