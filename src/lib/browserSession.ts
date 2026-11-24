export type BrowserSession = { token: string; userId: number; expiresAt: number; deviceId?: string };

const sessionKey = 'prodesk:browser-session';
export const browserSessionUpdated = 'prodesk:browser-session-updated';
export const browserSessionEnded = 'prodesk:browser-session-ended';

export function isBrowserSession(value: unknown): value is BrowserSession {
  if (!value || typeof value !== 'object') return false;
  const { token, userId, expiresAt, deviceId } = value as Partial<BrowserSession>;
  return typeof token === 'string' && token.length > 0 && token.length <= 4096 &&
    typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0 &&
    typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt) && expiresAt > Date.now() &&
    (deviceId === undefined || typeof deviceId === 'string');
}

function storedSession(): Partial<BrowserSession> | null {
  try { return JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null'); }
  catch { return null; }
}

export function readBrowserSession(): BrowserSession | null {
  const value = storedSession();
  return isBrowserSession(value) ? value : null;
}

export function storedBrowserDeviceId() {
  return storedSession()?.deviceId;
}

export function saveBrowserSession(session: BrowserSession) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(browserSessionUpdated, { detail: session }));
}

export function endBrowserSession(expired = false) {
  try { sessionStorage.removeItem(sessionKey); } catch { /* Storage is blocked. */ }
  window.dispatchEvent(new CustomEvent(browserSessionEnded, { detail: expired }));
}
