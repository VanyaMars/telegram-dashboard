import assert from 'node:assert/strict';
import { createBrowserSession, createLoginState, verifyBrowserUser, verifyLoginState } from '../supabase/functions/_shared/browser-auth.ts';

Deno.test('Telegram state is compact, expires, and authenticates the challenge and nonce', async () => {
  Deno.env.set('PRODESK_WEB_SESSION_SECRET', 'ab'.repeat(32));
  const challenge = 'C'.repeat(43);
  const nonce = 'N'.repeat(43);
  const state = await createLoginState(challenge, nonce);
  assert.ok(state.length <= 256, 'Telegram rejects OAuth state longer than 256 characters');
  assert.match(state, /^[A-Za-z0-9._-]+$/);
  assert.deepEqual(await verifyLoginState(state), { challenge, nonce });

  for (const field of [1, 2, 3, 4]) {
    const parts = state.split('.');
    parts[field] = (parts[field][0] === 'A' ? 'B' : 'A') + parts[field].slice(1);
    assert.equal(await verifyLoginState(parts.join('.')), null);
  }
  assert.equal(await verifyLoginState(state + 'x'.repeat(256)), null);
  assert.equal(await verifyLoginState(state + '\n'), null);

  const now = Date.now;
  try {
    const afterExpiry = now() + 601_000;
    Date.now = () => afterExpiry;
    assert.equal(await verifyLoginState(state), null);
  } finally {
    Date.now = now;
  }

  const session = await createBrowserSession({ id: 123456 });
  assert.equal(await verifyLoginState(session.token), null);
  assert.equal(await verifyBrowserUser(state), null);
  assert.equal((await verifyBrowserUser(session.token))?.id, 123456);
});
