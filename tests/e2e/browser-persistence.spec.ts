import { randomBytes, verify, createPublicKey } from 'node:crypto';
import { expect, test, chromium, type BrowserContext } from '@playwright/test';

test('browser sign-in survives a browser restart and sign-out removes it', async ({}, testInfo) => {
  const profile = testInfo.outputPath('browser-device-profile');
  const origin = new URL(testInfo.project.use.baseURL!).origin;
  const path = '/telegram-dashboard/';
  const deviceId = '1346aaa9-ab17-4aa2-acad-99e2f343be53';
  let deviceKey: string;
  let challenge: string;
  let loginExchanges = 0;
  let refreshes = 0;
  let signingOut = false;
  let offline = false;
  const session = () => ({ token: 'test-access-' + refreshes, userId: 123456, expiresAt: Date.now() + 120_000, deviceId });

  const openBrowser = async () => {
    const context = await chromium.launchPersistentContext(profile, testInfo.project.use.launchOptions);
    await context.route('https://telegram.org/js/telegram-web-app.js*', route => route.abort());
    await context.route('https://oauth.telegram.org/auth?**', route => {
      const authorization = new URL(route.request().url());
      const callback = new URL(path, origin);
      callback.searchParams.set('state', authorization.searchParams.get('state')!);
      callback.searchParams.set('code', 'test-telegram-code');
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    });
    await context.route('**/functions/v1/*', async route => {
      const body = route.request().postDataJSON();
      if (body.action === 'start') {
        const target = new URL('https://oauth.telegram.org/auth');
        target.searchParams.set('state', 'signed-test-state');
        return route.fulfill({ json: { ok: true, state: 'signed-test-state', authorizationUrl: target.href } });
      }
      if (body.action === 'exchange') {
        loginExchanges++;
        deviceKey = body.devicePublicKey;
        expect(deviceKey).toMatch(/^[\w-]{122}$/);
        return route.fulfill({ json: { ok: true, session: session() } });
      }
      if (body.action === 'device_challenge') {
        expect(body.deviceId).toBe(deviceId);
        if (offline) return route.fulfill({ status: 503, json: { error: 'Temporary outage' } });
        challenge = randomBytes(32).toString('base64url');
        return route.fulfill({ json: { ok: true, challenge } });
      }
      if (body.action === 'device_refresh' || body.action === 'device_logout') {
        expect(body.challenge).toBe(challenge);
        const key = createPublicKey({ key: Buffer.from(deviceKey, 'base64url'), format: 'der', type: 'spki' });
        const proof = Buffer.from(`prodesk-browser-device:${body.action}:${body.deviceId}:${challenge}`);
        expect(verify('sha256', proof, { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(body.signature, 'base64url'))).toBe(true);
        if (body.action === 'device_logout') {
          signingOut = true;
          return route.fulfill({ json: { ok: true } });
        }
        refreshes++;
        return route.fulfill({ json: { ok: true, session: session() } });
      }
      expect(body.browserSession).toBe(session().token);
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
      return route.fulfill({ json: { ok: true, settings: { tz: 'Europe/Moscow' }, tz: 'Europe/Moscow',
        today, categories: [], daily: [], buffer: [], goals: [], history: [] } });
    });
    return context;
  };

  let context: BrowserContext = await openBrowser();
  try {
    let page = await context.newPage();
    await page.goto(origin + path);
    await page.getByRole('button', { name: 'Войти через Telegram' }).click();
    await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
    expect(loginExchanges).toBe(1);
    await context.close();

    offline = true;
    context = await openBrowser();
    page = await context.newPage();
    await page.goto(origin + path);
    await expect(page.getByRole('alert')).toContainText('Не удалось восстановить вход');
    offline = false;
    await page.getByRole('button', { name: 'Повторить подключение' }).click();
    await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
    expect(loginExchanges).toBe(1);
    expect(refreshes).toBe(1);
    await page.getByRole('button', { name: 'Выйти из ProDesk' }).click();
    await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeEnabled();
    await expect.poll(() => signingOut).toBe(true);
    await context.close();

    context = await openBrowser();
    page = await context.newPage();
    await page.goto(origin + path);
    await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeEnabled();
    expect(refreshes).toBe(1);
  } finally {
    await context.close();
  }
});
