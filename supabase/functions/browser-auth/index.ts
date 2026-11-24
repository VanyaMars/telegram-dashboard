import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.3';
import { browserRedirectUrl, browserSiteOrigin, createBrowserSession, createLoginState, verifyLoginState } from '../_shared/browser-auth.ts';

const issuer = 'https://oauth.telegram.org';
const telegramKeys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
const encoder = new TextEncoder();
const challengePattern = /^[A-Za-z0-9_-]{43}$/;
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function config() {
  const botId = Deno.env.get('TG_BOT_TOKEN')?.split(':', 1)[0];
  const clientSecret = Deno.env.get('TG_OIDC_CLIENT_SECRET');
  const redirect = browserRedirectUrl();
  if (!botId || !/^[1-9]\d*$/.test(botId) || !clientSecret || !redirect) return null;
  return { botId, clientSecret, redirect: redirect.href, origin: redirect.origin };
}

Deno.serve(async (request: Request) => {
  const settings = config();
  const headers = {
    'Access-Control-Allow-Origin': settings?.origin ?? browserSiteOrigin(),
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  if (!settings) return reply({ error: 'Вход через Telegram пока недоступен.' }, 503);
  if (request.headers.get('origin') !== settings.origin) return reply({ error: 'Доступ закрыт.' }, 403);
  if (Number(request.headers.get('content-length')) > 8192) return reply({ error: 'Неверный запрос.' }, 400);

  const raw = await request.text();
  if (raw.length > 8192) return reply({ error: 'Неверный запрос.' }, 400);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'Неверный запрос.' }, 400); }
  if (!body || typeof body !== 'object') return reply({ error: 'Неверный запрос.' }, 400);

  try {
    if (body.action === 'start') {
      if (typeof body.challenge !== 'string' || !challengePattern.test(body.challenge)) {
        return reply({ error: 'Неверный запрос входа.' }, 400);
      }
      const stateRandom = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = await createLoginState(body.challenge, stateRandom);
      const authorizationUrl = new URL(issuer + '/auth');
      authorizationUrl.search = new URLSearchParams({
        client_id: settings.botId,
        redirect_uri: settings.redirect,
        response_type: 'code',
        scope: 'openid profile',
        state,
        code_challenge: body.challenge,
        code_challenge_method: 'S256'
      }).toString();
      return reply({ ok: true, authorizationUrl, state });
    }

    if (body.action !== 'exchange') return reply({ error: 'Неверный запрос.' }, 400);
    const { code, verifier } = body;
    if (typeof code !== 'string' || !code || code.length > 2048 ||
        typeof verifier !== 'string' || !verifierPattern.test(verifier)) {
      return reply({ error: 'Неверный запрос входа.' }, 400);
    }
    const state = await verifyLoginState(body.state);
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
    if (!state || state.challenge !== base64url(new Uint8Array(digest))) {
      return reply({ error: 'Запрос входа истёк. Попробуй ещё раз.' }, 401);
    }

    const result = await fetch(issuer + '/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(settings.botId + ':' + settings.clientSecret)
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, code_verifier: verifier,
        client_id: settings.botId, redirect_uri: settings.redirect
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error'
    });
    if (result.status === 400) return reply({ error: 'Не удалось подтвердить вход. Попробуй ещё раз.' }, 401);
    if (!result.ok) return reply({ error: 'Telegram временно недоступен. Попробуй ещё раз.' }, 502);
    const { id_token: idToken } = await result.json();
    if (typeof idToken !== 'string') return reply({ error: 'Telegram не подтвердил вход.' }, 401);

    let identity;
    try {
      const { payload } = await jwtVerify(idToken, telegramKeys, {
        algorithms: ['RS256'], issuer, audience: settings.botId, requiredClaims: ['sub', 'iat', 'exp']
      });
      // Telegram's code flow documents issuer, audience and expiry validation.
      // Existing requests may still have a nonce from the previous deployment.
      if (payload.nonce !== undefined && payload.nonce !== state.nonce) {
        console.warn('browser-auth: Telegram nonce mismatch');
        return reply({ error: 'Telegram не подтвердил профиль.' }, 401);
      }
      const rawId = payload.id;
      const id = typeof rawId === 'string' && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : rawId;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
        console.warn('browser-auth: missing or invalid Telegram profile ID');
        return reply({ error: 'Telegram не подтвердил профиль.' }, 401);
      }
      identity = {
        id,
        first_name: typeof payload.given_name === 'string' ? payload.given_name.slice(0, 128) :
          typeof payload.name === 'string' ? payload.name.split(/\s/, 1)[0].slice(0, 128) : undefined,
        username: typeof payload.preferred_username === 'string' ? payload.preferred_username.slice(0, 64) : undefined
      };
    } catch {
      console.warn('browser-auth: Telegram ID token verification failed');
      return reply({ error: 'Telegram не подтвердил вход.' }, 401);
    }
    const allowedUser = Deno.env.get('TG_ALLOWED_USER_ID');
    if (allowedUser && allowedUser !== String(identity.id)) {
      return reply({ error: 'Этот аккаунт пока не имеет доступа к ProDesk.' }, 403);
    }

    return reply({ ok: true, session: await createBrowserSession(identity) });
  } catch {
    return reply({ error: 'Не удалось войти. Попробуй ещё раз.' }, 503);
  }
});
