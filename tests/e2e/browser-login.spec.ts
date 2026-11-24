import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

const path = '/telegram-dashboard/';
const backend = '**/functions/v1/*';

test.beforeEach(async ({ page }) => {
  await page.route('https://telegram.org/js/telegram-web-app.js*', route => route.abort());
});

test('browser login returns to the requested page, keeps the tab session and signs out', async ({ page }) => {
  let challenge: string;
  let exchanges = 0;
  let reads = 0;
  const session = { token: 'prodesk-test-session', userId: 123456, expiresAt: Date.now() + 60_000 };
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  await page.route('https://oauth.telegram.org/auth?**', async route => {
    const request = new URL(route.request().url());
    expect(request.searchParams.get('code_challenge')).toBe(challenge);
    const callback = new URL(request.searchParams.get('redirect_uri')!);
    callback.searchParams.set('state', request.searchParams.get('state')!);
    callback.searchParams.set('code', 'telegram-test-code');
    await route.fulfill({ status: 302, headers: { location: callback.href } });
  });
  await page.route(backend, async route => {
    const body = route.request().postDataJSON();
    if (body.action === 'start') {
      challenge = body.challenge;
      expect(challenge).toMatch(/^[\w-]{43}$/);
      const redirect = new URL(path, new URL(page.url()).origin);
      const authorization = new URL('https://oauth.telegram.org/auth');
      authorization.search = new URLSearchParams({
        state: 'signed-test-state', redirect_uri: redirect.href, code_challenge: challenge
      }).toString();
      return route.fulfill({ json: { ok: true, authorizationUrl: authorization.href, state: 'signed-test-state' } });
    }
    if (body.action === 'exchange') {
      exchanges++;
      expect(body.code).toBe('telegram-test-code');
      expect(body.state).toBe('signed-test-state');
      expect(createHash('sha256').update(body.verifier).digest('base64url')).toBe(challenge);
      return route.fulfill({ json: { ok: true, session } });
    }
    expect(body.browserSession).toBe(session.token);
    expect(body.initData).toBeUndefined();
    if (body.action === 'read') reads++;
    return route.fulfill({ json: {
      ok: true, settings: { tz: 'Europe/Moscow' }, tz: 'Europe/Moscow', today,
      categories: [], daily: [], buffer: [], goals: [], history: []
    } });
  });

  await page.goto(path + '#/tab/today');
  await expect(page.getByRole('heading', { name: 'ProDesk' })).toBeVisible();
  expect(reads).toBe(0);
  await page.getByRole('button', { name: 'Войти через Telegram' }).click();
  await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible();
  expect(exchanges).toBe(1);
  expect(new URL(page.url()).search).toBe('');
  expect(new URL(page.url()).hash).toBe('#/tab/today');
  await page.reload();
  const logout = page.getByRole('button', { name: 'Выйти из ProDesk' });
  await expect(logout).toBeVisible();
  expect(exchanges).toBe(1);
  expect(reads).toBeGreaterThan(1);
  await logout.click();
  await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible();
});

test('an unsolicited Telegram callback cannot be exchanged', async ({ page }) => {
  let exchanges = 0;
  await page.route(backend, route => {
    exchanges++;
    return route.abort();
  });
  await page.goto(path + '?code=unexpected&state=unknown');
  await expect(page.getByRole('alert')).toContainText('Запрос входа не найден');
  expect(exchanges).toBe(0);
  expect(new URL(page.url()).search).toBe('');
});

test('an expired browser session returns to the Telegram sign-in screen', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('prodesk:browser-session', JSON.stringify({
      token: 'revoked-test-token', userId: 123456, expiresAt: Date.now() + 60_000
    }));
  });
  await page.route(backend, async route => {
    expect(route.request().postDataJSON().browserSession).toBe('revoked-test-token');
    await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
  });
  await page.goto(path);
  await expect(page.getByRole('alert')).toContainText('Сессия истекла');
  await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeEnabled();
});
