import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';

const sessionToken = 'e'.repeat(43);
const sessionTokenHash = createHash('sha256').update(sessionToken, 'utf8').digest('hex');

test.beforeAll(() => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL is missing');

  const database = new Database(databaseUrl);
  const now = Date.now();

  try {
    database
      .prepare(
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
      )
      .run('e2e-user', '424242', 'test_user', 'Test', 'User', null, 'ru', now, now, now);

    database
      .prepare(
        `insert into sessions (
          token_hash, user_id, expires_at, created_at, last_seen_at
        ) values (?, ?, ?, ?, ?)
        on conflict(token_hash) do update set
          user_id = excluded.user_id,
          expires_at = excluded.expires_at,
          last_seen_at = excluded.last_seen_at`
      )
      .run(sessionTokenHash, 'e2e-user', now + 60 * 60 * 1000, now, now);
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

test('authenticated shell renders profile, navigation, swipe and UI primitives', async ({
  context,
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await context.addCookies([
    {
      name: 'vpn_session',
      value: sessionToken,
      url: 'http://127.0.0.1:4173',
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]);

  await page.goto('/');

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByTestId('section-home')).toHaveAttribute('aria-hidden', 'false');

  await page.getByTestId('nav-profile').click();
  expect(pageErrors).toEqual([]);
  await expect(page.getByTestId('nav-profile')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('section-profile')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible();
  await expect(page.getByText('@test_user')).toBeVisible();

  await page.getByTestId('nav-home').click();
  await page.getByTestId('pager').evaluate((pager) => {
    const start = new Touch({ identifier: 1, target: pager, clientX: 320, clientY: 300 });
    const end = new Touch({ identifier: 1, target: pager, clientX: 220, clientY: 305 });
    pager.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
    pager.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
  });
  await expect(page.getByTestId('section-profile')).toHaveAttribute('aria-hidden', 'false');

  await page.goto('/dev/kitchen-sink');
  await expect(page.getByRole('heading', { name: 'UI Kitchen Sink' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Основная кнопка' })).toBeVisible();
});
