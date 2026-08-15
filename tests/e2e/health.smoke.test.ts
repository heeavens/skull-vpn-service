import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createTelegramInitData } from '../helpers/telegram';

interface TelegramTestBridge {
  calls: { ready: number; expand: number };
  setTheme(theme: 'light' | 'dark'): void;
}

declare global {
  interface Window {
    __telegramTest: TelegramTestBridge;
  }
}

const sessionToken = 'e'.repeat(43);
const adminSessionToken = 'f'.repeat(43);
const expiredSessionToken = 'g'.repeat(43);
const sessionTokenHash = createHash('sha256').update(sessionToken, 'utf8').digest('hex');
const adminSessionTokenHash = createHash('sha256').update(adminSessionToken, 'utf8').digest('hex');
const expiredSessionTokenHash = createHash('sha256')
  .update(expiredSessionToken, 'utf8')
  .digest('hex');
const e2eTelegramBotToken = '123456789:abcdefghijklmnopqrstuvwxyzABCDE';
const authenticatedTelegramUserId = 777000111;

test.beforeAll(() => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL is missing');

  const database = new Database(databaseUrl);
  const now = Date.now();

  try {
    const upsertUser = database.prepare(
      `insert into users (
          id, telegram_user_id, username, first_name, last_name, photo_url, language_code,
          last_auth_at, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          username = excluded.username,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          photo_url = excluded.photo_url,
          language_code = excluded.language_code,
          last_auth_at = excluded.last_auth_at,
          updated_at = excluded.updated_at`
    );

    upsertUser.run('e2e-user', '424242', 'test_user', 'Test', 'User', null, 'ru', now, now, now);
    upsertUser.run(
      'e2e-admin',
      '123456789',
      null,
      'Admin',
      null,
      'https://images.example.test/missing-avatar.jpg',
      null,
      now,
      now,
      now
    );

    const upsertSession = database.prepare(
      `insert into sessions (
          token_hash, user_id, expires_at, created_at, last_seen_at
        ) values (?, ?, ?, ?, ?)
        on conflict(token_hash) do update set
          user_id = excluded.user_id,
          expires_at = excluded.expires_at,
          last_seen_at = excluded.last_seen_at`
    );

    upsertSession.run(sessionTokenHash, 'e2e-user', now + 60 * 60 * 1000, now, now);
    upsertSession.run(adminSessionTokenHash, 'e2e-admin', now + 60 * 60 * 1000, now, now);
    upsertSession.run(expiredSessionTokenHash, 'e2e-user', now - 1, now - 10_000, now - 10_000);
  } finally {
    database.close();
  }
});

test('liveness and readiness ignore an unrelated session cookie', async ({ request }) => {
  const headers = { cookie: 'vpn_session=malformed' };
  const live = await request.get('/health/live', { headers });
  const ready = await request.get('/health/ready', { headers });

  expect(live.status()).toBe(200);
  await expect(live.json()).resolves.toEqual({ status: 'ok' });
  expect(ready.status()).toBe(200);
  await expect(ready.json()).resolves.toEqual({ status: 'ready' });
});

test('auth guard sends an anonymous browser to the Telegram gate', async ({ page }) => {
  await page.route('https://telegram.org/**', (route) => route.abort());
  await page.goto('/');

  await expect(page).toHaveURL(/\/open-in-telegram$/);
  await expect(
    page.getByRole('heading', { name: 'Откройте приложение через Telegram' })
  ).toBeVisible();
});

test('auth guard rejects an expired session and clears its cookie', async ({ request }) => {
  const response = await request.get('/', {
    headers: { cookie: `vpn_session=${expiredSessionToken}` },
    maxRedirects: 0
  });

  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/open-in-telegram');
  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toMatch(/^vpn_session=;/);
  expect(setCookie).toContain('Max-Age=0');
  expect(setCookie).toContain('Path=/');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('Secure');
  expect(setCookie).toContain('SameSite=Lax');
});

test('Telegram bridge creates a hashed session and logout revokes it', async ({
  context,
  page
}) => {
  const rawInitData = createTelegramInitData({
    botToken: e2eTelegramBotToken,
    authDate: Math.floor(Date.now() / 1000),
    user: {
      id: authenticatedTelegramUserId,
      username: 'bridge_user',
      first_name: 'Bridge',
      last_name: 'User',
      language_code: 'ru'
    }
  });
  await installTelegramBridge(page, 'light', rawInitData);

  await page.goto('/open-in-telegram');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'vpn_session');
  expect(sessionCookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
  expect(sessionCookie?.value).toMatch(/^[A-Za-z\d_-]{43}$/);

  const storedSession = readAuthenticatedSession();
  expect(storedSession).toEqual({
    tokenHash: createHash('sha256').update(sessionCookie!.value, 'utf8').digest('hex'),
    telegramUserId: String(authenticatedTelegramUserId),
    username: 'bridge_user'
  });
  expect(JSON.stringify(storedSession)).not.toContain(rawInitData);

  const rejectedLogout = await context.request.post('/api/auth/logout', {
    headers: { origin: 'https://attacker.example' }
  });
  expect(rejectedLogout.status()).toBe(403);
  await expect(rejectedLogout.json()).resolves.toMatchObject({
    error: { code: 'REQUEST_ORIGIN_INVALID' }
  });
  expect(readAuthenticatedSession()).toEqual(storedSession);

  const logoutStatus = await page.evaluate(async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    return response.status;
  });
  expect(logoutStatus).toBe(204);
  expect((await context.cookies()).find((cookie) => cookie.name === 'vpn_session')).toBeUndefined();
  expect(readAuthenticatedSession()).toBeUndefined();

  await page.goto('/');
  await expect(page).toHaveURL(/\/open-in-telegram$/);
});

test('auth HTTP contract rejects unsafe requests without database writes', async ({ request }) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const forged = createTelegramInitData({
    botToken: e2eTelegramBotToken,
    authDate: nowSeconds,
    user: { id: 777000112, username: 'signed_user', first_name: 'Signed' }
  }).replace('signed_user', 'forged_user');
  const expired = createTelegramInitData({
    botToken: e2eTelegramBotToken,
    authDate: nowSeconds - 301,
    user: { id: 777000113, first_name: 'Expired' }
  });

  for (const [rawInitData, code] of [
    [forged, 'TELEGRAM_INIT_DATA_INVALID'],
    [expired, 'TELEGRAM_INIT_DATA_EXPIRED']
  ] as const) {
    const response = await request.post('/api/auth/telegram', {
      data: rawInitData,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  }

  const unsupported = await request.post('/api/auth/telegram', { data: '{}' });
  expect(unsupported.status()).toBe(415);
  await expect(unsupported.json()).resolves.toMatchObject({
    error: { code: 'REQUEST_CONTENT_TYPE_INVALID' }
  });

  const oversized = await request.post('/api/auth/telegram', {
    data: 'x'.repeat(16 * 1024 + 1),
    headers: { 'content-type': 'text/plain' }
  });
  expect(oversized.status()).toBe(413);
  await expect(oversized.json()).resolves.toMatchObject({
    error: { code: 'REQUEST_BODY_TOO_LARGE' }
  });

  expect(countUsers(['777000112', '777000113'])).toBe(0);
});

test('returning session initializes Telegram lifecycle and follows its theme', async ({
  context,
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installTelegramBridge(page, 'dark');
  await addSessionCookie(context, sessionToken);

  await page.goto('/');

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-theme-source', 'telegram');
  await expect.poll(() => getTelegramLifecycleCalls(page)).toEqual({ ready: 1, expand: 1 });
  await expectAppShellColors(page, {
    background: 'rgb(17, 18, 24)',
    text: 'rgb(247, 247, 251)'
  });

  await page.evaluate(() => window.__telegramTest.setTheme('light'));
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-theme', 'light');
  await expectAppShellColors(page, {
    background: 'rgb(255, 255, 255)',
    text: 'rgb(10, 10, 16)'
  });

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-theme-bg-color', '#05060a');
    document.documentElement.style.setProperty('--tg-theme-text-color', '#fafafa');
    const shell = document.querySelector<HTMLElement>('[data-testid="app-shell"]');
    shell?.setAttribute('data-theme-source', 'explicit');
  });
  await expectAppShellColors(page, {
    background: 'rgb(255, 255, 255)',
    text: 'rgb(10, 10, 16)'
  });
  expect(pageErrors).toEqual([]);
});

test('navigation buttons and guarded swipes keep sections synchronized', async ({
  context,
  page
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await installTelegramBridge(page, 'light');
  await addSessionCookie(context, sessionToken);

  await page.goto('/');
  await expect.poll(() => getTelegramLifecycleCalls(page)).toEqual({ ready: 1, expand: 1 });

  const navigationButtons = page.locator('.glass-nav button');
  await expect(navigationButtons).toHaveCount(3);
  await expect(navigationButtons.nth(0)).toContainText('Поддержка');
  await expect(navigationButtons.nth(1)).toContainText('Главная');
  await expect(navigationButtons.nth(2)).toContainText('Профиль');
  for (const button of await navigationButtons.all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');

  await dispatchTouchGesture(page, { x: 300, y: 280 }, { x: 258, y: 284 });
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');

  await dispatchTouchGesture(page, { x: 300, y: 220 }, { x: 215, y: 350 });
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');

  await dispatchTouchGesture(page, { x: 280, y: 260 }, { x: 350, y: 264 });
  await expect(page.getByTestId('section-support')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByTestId('nav-support')).toHaveAttribute('aria-current', 'page');
  await expectSectionAlignedWithPager(page, 'support');

  await dispatchTouchGesture(page, { x: 280, y: 260 }, { x: 350, y: 264 });
  await expect(page.getByTestId('section-support')).toHaveAttribute('aria-hidden', 'false');

  const supportScroll = page.locator('#section-support .swipe-pager__scroll');
  await supportScroll.evaluate((element) => element.scrollTo({ top: 180 }));
  const supportScrollTop = await supportScroll.evaluate((element) => element.scrollTop);
  expect(supportScrollTop).toBeGreaterThan(0);

  await dispatchTouchGesture(page, { x: 300, y: 260 }, { x: 205, y: 265 });
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');
  await dispatchTouchGesture(page, { x: 300, y: 260 }, { x: 205, y: 265 });
  await expect(page.getByTestId('section-profile')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByTestId('nav-profile')).toHaveAttribute('aria-current', 'page');
  await expectSectionAlignedWithPager(page, 'profile');

  await dispatchTouchGesture(page, { x: 300, y: 260 }, { x: 205, y: 265 });
  await expect(page.getByTestId('section-profile')).toHaveAttribute('aria-hidden', 'false');

  await page.getByTestId('nav-support').click();
  await expect(supportScroll).toHaveJSProperty('scrollTop', supportScrollTop);
  await page.getByTestId('nav-home').click();
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('nav-profile').click();
  await page.getByRole('button', { name: 'Перейти на главную' }).click();
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeFocused();

  await expectSectionAlignedWithPager(page, 'home');
});

test('profile renders public Telegram data, neutral avatar fallback and admin visibility', async ({
  context,
  page
}) => {
  await installTelegramBridge(page, 'light');
  await addSessionCookie(context, sessionToken);

  await page.goto('/');
  await expect.poll(() => getTelegramLifecycleCalls(page)).toEqual({ ready: 1, expand: 1 });
  await page.getByTestId('nav-profile').click();
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible();
  await expect(page.getByText('@test_user')).toBeVisible();
  await expect(page.getByText('Админ-панель')).toHaveCount(0);
  await expect(page.locator('#section-profile .ui-avatar img')).toHaveCount(0);
  await expect(page.locator('#section-profile .ui-avatar .ui-icon')).toBeVisible();
  await expectSectionAlignedWithPager(page, 'profile');

  await context.clearCookies();
  await addSessionCookie(context, adminSessionToken);
  await page.goto('/');
  await expect.poll(() => getTelegramLifecycleCalls(page)).toEqual({ ready: 1, expand: 1 });
  await page.getByTestId('nav-profile').click();

  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByText('Username не указан')).toBeVisible();
  await expect(page.getByText('Администратор')).toBeVisible();
  await expect(page.getByText('Админ-панель')).toBeVisible();
  await page
    .locator('#section-profile .ui-avatar img')
    .evaluate((image) => image.dispatchEvent(new Event('error')));
  await expect(page.locator('#section-profile .ui-avatar img')).toHaveCount(0);
  await expect(page.locator('#section-profile .ui-avatar .ui-icon')).toBeVisible();
});

test('reduced motion disables pager animation', async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegramBridge(page, 'light');
  await addSessionCookie(context, sessionToken);

  await page.goto('/');
  const transitionDuration = await page
    .locator('.swipe-pager__track')
    .evaluate((element) => getComputedStyle(element).transitionDuration);

  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.00001);
});

test('authenticated shell renders the shared UI primitives', async ({ context, page }) => {
  await installTelegramBridge(page, 'light');
  await addSessionCookie(context, sessionToken);

  await page.goto('/dev/kitchen-sink');
  await expect(page.getByRole('heading', { name: 'UI Kitchen Sink' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Основная кнопка' })).toBeVisible();
});

async function addSessionCookie(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    {
      name: 'vpn_session',
      value: token,
      url: 'http://127.0.0.1:4173',
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]);
}

async function installTelegramBridge(
  page: Page,
  initialTheme: 'light' | 'dark',
  initData = ''
): Promise<void> {
  await page.route('https://telegram.org/**', (route) => route.abort());
  await page.addInitScript(
    ({ initData, theme }) => {
      const listeners = new Set<() => void>();
      const calls = { ready: 0, expand: 0 };
      const webApp = {
        initData,
        colorScheme: theme,
        ready: () => {
          calls.ready += 1;
        },
        expand: () => {
          calls.expand += 1;
        },
        onEvent: (event: string, listener: () => void) => {
          if (event === 'themeChanged') listeners.add(listener);
        },
        offEvent: (event: string, listener: () => void) => {
          if (event === 'themeChanged') listeners.delete(listener);
        }
      };

      Object.assign(window, {
        Telegram: { WebApp: webApp },
        __telegramTest: {
          calls,
          setTheme: (nextTheme: 'light' | 'dark') => {
            webApp.colorScheme = nextTheme;
            for (const listener of listeners) listener();
          }
        }
      });
    },
    { initData, theme: initialTheme }
  );
}

function readAuthenticatedSession():
  { tokenHash: string; telegramUserId: string; username: string | null } | undefined {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL is missing');
  const database = new Database(databaseUrl, { readonly: true });

  try {
    return database
      .prepare(
        `select
          sessions.token_hash as tokenHash,
          users.telegram_user_id as telegramUserId,
          users.username as username
        from sessions
        inner join users on users.id = sessions.user_id
        where users.telegram_user_id = ?`
      )
      .get(String(authenticatedTelegramUserId)) as
      { tokenHash: string; telegramUserId: string; username: string | null } | undefined;
  } finally {
    database.close();
  }
}

function countUsers(telegramUserIds: readonly string[]): number {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL is missing');
  const database = new Database(databaseUrl, { readonly: true });

  try {
    const placeholders = telegramUserIds.map(() => '?').join(', ');
    const result = database
      .prepare(`select count(*) as count from users where telegram_user_id in (${placeholders})`)
      .get(...telegramUserIds) as { count: number };
    return result.count;
  } finally {
    database.close();
  }
}

async function getTelegramLifecycleCalls(page: Page): Promise<{ ready: number; expand: number }> {
  return page.evaluate(() => window.__telegramTest.calls);
}

async function expectAppShellColors(
  page: Page,
  expected: { background: string; text: string }
): Promise<void> {
  await expect
    .poll(() =>
      page.getByTestId('app-shell').evaluate((shell) => {
        const style = getComputedStyle(shell);
        return { background: style.backgroundColor, text: style.color };
      })
    )
    .toEqual(expected);
}

async function dispatchTouchGesture(
  page: Page,
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number }
): Promise<void> {
  await page.getByTestId('pager').evaluate(
    (pager, gesture) => {
      const start = new Touch({
        identifier: 1,
        target: pager,
        clientX: gesture.startPoint.x,
        clientY: gesture.startPoint.y
      });
      const end = new Touch({
        identifier: 1,
        target: pager,
        clientX: gesture.endPoint.x,
        clientY: gesture.endPoint.y
      });
      pager.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
      pager.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
    },
    { startPoint, endPoint }
  );
}

async function expectSectionAlignedWithPager(
  page: Page,
  section: 'support' | 'home' | 'profile'
): Promise<void> {
  await expect
    .poll(async () => {
      const pagerBox = await page.getByTestId('pager').boundingBox();
      const sectionBox = await page.getByTestId(`section-${section}`).boundingBox();
      if (!pagerBox || !sectionBox) return Number.POSITIVE_INFINITY;
      return Math.abs(pagerBox.x - sectionBox.x);
    })
    .toBeLessThan(2);
}
