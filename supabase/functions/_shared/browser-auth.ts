import { base64url, jwtVerify, SignJWT, type JWTPayload } from 'npm:jose@6.1.3';

const issuer = 'prodesk-browser-auth';
const sessionAudience = 'prodesk-api';
const loginStatePattern = /^v1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})\.([0-9a-z]{1,8})\.([A-Za-z0-9_-]{43})$/;
const loginLifetime = 600;
const sessionLifetime = 12 * 60 * 60;
const encoder = new TextEncoder();

export type BrowserUser = { id: number; first_name?: string; username?: string };

export function browserRedirectUrl() {
  const redirect = Deno.env.get('PRODESK_WEB_REDIRECT_URL');
  if (!redirect) return null;
  try {
    const url = new URL(redirect);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search ? url : null;
  } catch {
    return null;
  }
}

export function browserSiteOrigin() {
  return browserRedirectUrl()?.origin ?? 'https://vanyamars.github.io';
}

function signingKey() {
  const secret = Deno.env.get('PRODESK_WEB_SESSION_SECRET');
  return secret && /^[a-f0-9]{64}$/i.test(secret) ? encoder.encode(secret) : null;
}

async function signBrowserCredential(payload: JWTPayload, expiresAt: number) {
  const key = signingKey();
  if (!key) throw new Error('Browser session signing is unavailable');
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(sessionAudience)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);
}

async function verifyBrowserCredential(token: unknown) {
  const key = signingKey();
  if (!key || typeof token !== 'string' || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer, audience: sessionAudience, typ: 'JWT', requiredClaims: ['iat', 'exp']
    });
    return payload;
  } catch {
    return null;
  }
}

async function loginSigningKey() {
  const secret = signingKey();
  if (!secret) return null;
  return await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function loginStateMessage(state: string) {
  return encoder.encode('prodesk-telegram-login:' + state);
}

export async function createLoginState(challenge: string, nonce: string) {
  const key = await loginSigningKey();
  if (!key) throw new Error('Telegram login state signing is unavailable');

  // Telegram limits the length of the OAuth state. Keep the PKCE challenge,
  // nonce and expiry in a compact signed value instead of a JWT.
  const expiry = (Math.floor(Date.now() / 1000) + loginLifetime).toString(36);
  const state = ['v1', challenge, nonce, expiry].join('.');
  const signature = await crypto.subtle.sign('HMAC', key, loginStateMessage(state));
  return state + '.' + base64url.encode(new Uint8Array(signature));
}

export async function verifyLoginState(token: unknown) {
  if (typeof token !== 'string' || token.length > 143) return null;
  const match = loginStatePattern.exec(token);
  if (!match || match[0] !== token) return null;
  const [, challenge, nonce, expiry, signature] = match;
  const expiresAt = Number.parseInt(expiry, 36);
  if (expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const key = await loginSigningKey();
  if (!key) return null;
  const rawSignature = new Uint8Array(base64url.decode(signature));
  if (base64url.encode(rawSignature) !== signature) return null;
  const message = loginStateMessage(token.slice(0, token.lastIndexOf('.')));
  return await crypto.subtle.verify('HMAC', key, rawSignature, message) ? { challenge, nonce } : null;
}

export async function createBrowserSession(user: BrowserUser, lifetime = sessionLifetime) {
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const token = await signBrowserCredential({
    sub: String(user.id), first_name: user.first_name, username: user.username
  }, expires);
  return { token, userId: user.id, expiresAt: expires * 1000 };
}

export async function verifyBrowserUser(token: unknown): Promise<BrowserUser | null> {
  const payload = await verifyBrowserCredential(token);
  const id = Number(payload?.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: typeof payload?.first_name === 'string' ? payload.first_name : undefined,
    username: typeof payload?.username === 'string' ? payload.username : undefined
  };
}
