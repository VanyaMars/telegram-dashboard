import { jwtVerify, SignJWT, type JWTPayload } from 'npm:jose@6.1.3';

const issuer = 'prodesk-browser-auth';
const sessionAudience = 'prodesk-api';
const loginAudience = 'prodesk-telegram-login';
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

async function signBrowserCredential(payload: JWTPayload, audience: string, expiresAt: number) {
  const key = signingKey();
  if (!key) throw new Error('Browser session signing is unavailable');
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);
}

async function verifyBrowserCredential(token: unknown, audience: string) {
  const key = signingKey();
  if (!key || typeof token !== 'string' || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer, audience, typ: 'JWT', requiredClaims: ['iat', 'exp']
    });
    return payload;
  } catch {
    return null;
  }
}

export async function createLoginState(challenge: string, nonce: string) {
  return await signBrowserCredential({ challenge, nonce }, loginAudience, Math.floor(Date.now() / 1000) + 600);
}

export async function verifyLoginState(token: unknown) {
  const payload = await verifyBrowserCredential(token, loginAudience);
  if (typeof payload?.challenge !== 'string' || typeof payload.nonce !== 'string') return null;
  return { challenge: payload.challenge, nonce: payload.nonce };
}

export async function createBrowserSession(user: BrowserUser) {
  const expires = Math.floor(Date.now() / 1000) + sessionLifetime;
  const token = await signBrowserCredential({
    sub: String(user.id), first_name: user.first_name, username: user.username
  }, sessionAudience, expires);
  return { token, userId: user.id, expiresAt: expires * 1000 };
}

export async function verifyBrowserUser(token: unknown): Promise<BrowserUser | null> {
  const payload = await verifyBrowserCredential(token, sessionAudience);
  const id = Number(payload?.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: typeof payload?.first_name === 'string' ? payload.first_name : undefined,
    username: typeof payload?.username === 'string' ? payload.username : undefined
  };
}
