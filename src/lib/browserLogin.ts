import { SUPABASE_URL } from './api';
import { isBrowserSession, saveBrowserSession } from './browserSession';

const pendingKey = 'prodesk:pending-telegram-login';
const callbackKeys = ['code', 'state', 'error', 'error_description', 'error_uri', 'iss'];
const telegramOrigin = 'https://oauth.telegram.org';

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
    throw new Error(typeof body?.error === 'string' && response.status !== 404 ?
      body.error : 'Вход через Telegram пока недоступен. Попробуй ещё раз.');
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
  const { session } = await authRequest({ action: 'exchange', state, code, verifier: pending.verifier });
  if (!isBrowserSession(session)) throw new Error('Не удалось открыть сессию ProDesk.');

  const returnUrl = new URL(pending.returnPath, window.location.origin);
  if (returnUrl.origin === window.location.origin) {
    window.history.replaceState(window.history.state, '', returnUrl);
  }
  saveBrowserSession(session);
  return session;
}
