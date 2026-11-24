import { SUPABASE_URL } from './supabase';
import { deviceLogoutKey, readBrowserDevice, removeBrowserDevice, saveBrowserDevice, type BrowserDevice } from './browserDevice';
import { endBrowserSession, isBrowserSession, saveBrowserSession, storedBrowserDeviceId, type BrowserSession } from './browserSession';

const pendingKey = 'prodesk:pending-telegram-login';
const callbackKeys = ['code', 'state', 'error', 'error_description', 'error_uri', 'iss'];
const telegramOrigin = 'https://oauth.telegram.org';

class BrowserAuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function authRequest(fields: Record<string, string>) {
  const response = await fetch(SUPABASE_URL + '/functions/v1/browser-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    throw new BrowserAuthError(typeof body?.error === 'string' && response.status !== 404 ?
      body.error : 'Вход через Telegram пока недоступен. Попробуй ещё раз.', response.status);
  }
  return body;
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startBrowserLogin() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const { authorizationUrl, state } = await authRequest({
    action: 'start', challenge: base64url(new Uint8Array(digest))
  });
  const target = new URL(authorizationUrl);
  if (target.origin !== telegramOrigin || target.pathname !== '/auth' ||
      typeof state !== 'string' || target.searchParams.get('state') !== state) {
    throw new Error('Не удалось открыть вход через Telegram.');
  }

  const current = new URL(window.location.href);
  for (const key of callbackKeys) current.searchParams.delete(key);
  sessionStorage.setItem(pendingKey, JSON.stringify({
    state, verifier, returnPath: current.pathname + current.search + current.hash
  }));
  window.location.assign(target);
}

export function hasLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('state') || params.has('error');
}

export async function finishBrowserLogin() {
  const url = new URL(window.location.href);
  const { code, error, state, iss } = Object.fromEntries(url.searchParams);
  const raw = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  for (const key of callbackKeys) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url);

  const pending = raw ? JSON.parse(raw) : null;
  if (!pending || !state || state !== pending.state || (iss && iss !== telegramOrigin)) {
    throw new Error('Запрос входа не найден или истёк. Попробуй ещё раз.');
  }
  if (error || !code) throw new Error('Вход через Telegram не завершён.');
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']
  ).catch(() => null);
  const publicKey = keyPair ? await crypto.subtle.exportKey('spki', keyPair.publicKey).catch(() => null) : null;
  const devicePublicKey = publicKey ? base64url(new Uint8Array(publicKey)) : undefined;
  const { session } = await authRequest({
    action: 'exchange', state, code, verifier: pending.verifier,
    ...(devicePublicKey ? { devicePublicKey } : {})
  });
  if (!isBrowserSession(session)) throw new Error('Не удалось открыть сессию ProDesk.');

  const returnUrl = new URL(pending.returnPath, window.location.origin);
  if (returnUrl.origin === window.location.origin) {
    window.history.replaceState(window.history.state, '', returnUrl);
  }
  if (session.deviceId && keyPair) {
    try {
      await saveBrowserDevice({ id: session.deviceId, privateKey: keyPair.privateKey });
    } catch {
      void useDevice({ id: session.deviceId, privateKey: keyPair.privateKey }, 'device_logout').catch(() => {});
      delete session.deviceId;
    }
  }
  saveBrowserSession(session);
  return session;
}

async function useDevice(device: BrowserDevice, action: 'device_refresh' | 'device_logout') {
  for (let attempt = 0; ; attempt++) {
    const { challenge } = await authRequest({ action: 'device_challenge', deviceId: device.id });
    if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new Error('Не удалось восстановить сессию браузера.');
    }
    const message = new TextEncoder().encode(`prodesk-browser-device:${action}:${device.id}:${challenge}`);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, device.privateKey, message);
    try {
      return await authRequest({
        action, deviceId: device.id, challenge, signature: base64url(new Uint8Array(signature))
      });
    } catch (error) {
      if (!(error instanceof BrowserAuthError) || error.status !== 409 || attempt >= 2) throw error;
    }
  }
}

let restoring: Promise<BrowserSession | null> | null = null;
let signingOut = false;

export function restoreBrowserSession() {
  if (signingOut) return Promise.resolve(null);
  restoring ??= (async () => {
    const device = await readBrowserDevice();
    if (!device || signingOut) return null;
    try {
      const { session } = await useDevice(device, 'device_refresh');
      if (!isBrowserSession(session) || session.deviceId !== device.id) {
        throw new Error('Не удалось восстановить сессию браузера.');
      }
      if (signingOut || (await readBrowserDevice())?.id !== device.id) return null;
      saveBrowserSession(session);
      return session;
    } catch (error) {
      if (error instanceof BrowserAuthError && (error.status === 401 || error.status === 403)) {
        await removeBrowserDevice(device.id);
        return null;
      }
      throw error;
    }
  })().finally(() => { restoring = null; });
  return restoring;
}

export async function signOutBrowser() {
  if (signingOut) return;
  signingOut = true;
  try {
    const id = storedBrowserDeviceId();
    const device = id ? await readBrowserDevice() : undefined;
    // An account can change in another tab. Revoke only the device for this session.
    if (device && device.id === id) {
      await removeBrowserDevice(device.id);
      try { localStorage.setItem(deviceLogoutKey, device.id); } catch { /* Optional cross-tab notification. */ }
      endBrowserSession();
      void useDevice(device, 'device_logout').catch(() => {});
      return;
    }
    endBrowserSession();
  } finally {
    signingOut = false;
  }
}
