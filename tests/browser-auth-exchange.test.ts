import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'npm:jose@6.1.3';
import { verifyBrowserUser, verifyLoginState } from '../supabase/functions/_shared/browser-auth.ts';

Deno.test('Telegram code exchange accepts the signed profile ID with or without a legacy nonce', async () => {
  const origin = 'https://prodesk.example';
  const issuer = 'https://oauth.telegram.org';
  const botId = '107005';
  const userId = 245001;
  for (const [key, value] of Object.entries({
    TG_BOT_TOKEN: botId + ':test-only',
    TG_OIDC_CLIENT_SECRET: 'test-only',
    PRODESK_WEB_REDIRECT_URL: origin + '/',
    PRODESK_WEB_SESSION_SECRET: 'ab'.repeat(32),
    TG_ALLOWED_USER_ID: String(userId)
  })) Deno.env.set(key, value);

  const realServe = Deno.serve;
  const realFetch = globalThis.fetch;
  let handler: Deno.ServeHandler | undefined;
  Object.defineProperty(Deno, 'serve', { value: (fn: Deno.ServeHandler) => { handler = fn; } });
  try {
    await import('../supabase/functions/browser-auth/index.ts');
  } finally {
    Object.defineProperty(Deno, 'serve', { value: realServe });
  }

  assert.ok(handler);
  const receive = handler;
  const post = async (body: Record<string, unknown>) =>
    await receive(new Request(origin + '/functions/v1/browser-auth', {
      method: 'POST', headers: { origin }, body: JSON.stringify(body)
    }), {} as Deno.ServeHandlerInfo);

  const verifier = 'E'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const start = await post({ action: 'start', challenge });
  assert.equal(start.status, 200);
  const { state, authorizationUrl } = await start.json();
  const loginParams = new URL(authorizationUrl).searchParams;
  assert.equal(loginParams.get('code_challenge'), challenge);
  assert.equal(loginParams.has('nonce'), false);

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  let claims: JWTPayload = { id: userId };
  let audience = botId;
  let tokenRequests = 0;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url === issuer + '/.well-known/jwks.json') {
      return Response.json({ keys: [{ ...await exportJWK(publicKey), kid: 'test-key' }] });
    }
    assert.equal(url, issuer + '/token');
    const tokenRequest = options?.body as URLSearchParams;
    assert.equal(tokenRequest.get('code_verifier'), verifier);
    assert.equal(tokenRequest.get('grant_type'), 'authorization_code');
    tokenRequests++;
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer).setAudience(audience).setSubject('different-oidc-subject')
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    return Response.json({ id_token: token });
  };

  const exchange = (overrides = {}) =>
    post({ action: 'exchange', state, verifier, code: 'fixture-code', ...overrides });

  try {
    assert.equal((await exchange({ verifier: 'F'.repeat(43) })).status, 401);
    assert.equal(tokenRequests, 0);
    for (const id of [userId, String(userId)]) {
      claims = { id };
      const response = await exchange();
      assert.equal(response.status, 200);
      const { session } = await response.json();
      assert.equal((await verifyBrowserUser(session.token))?.id, userId);
    }
    claims = { id: userId, nonce: (await verifyLoginState(state))?.nonce };
    assert.equal((await exchange()).status, 200);
    claims = { id: userId, nonce: 'different-nonce' };
    assert.equal((await exchange()).status, 401);
    for (const id of [undefined, true, '0245001', '245001.0', '9007199254740992']) {
      claims = id === undefined ? {} : { id };
      assert.equal((await exchange()).status, 401);
    }
    claims = { id: userId + 1 };
    assert.equal((await exchange()).status, 403);
    claims = { id: userId };
    audience = 'wrong-bot';
    assert.equal((await exchange()).status, 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});
