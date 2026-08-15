import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const baseURL = `http://${host}:${port}`;
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? join(tmpdir(), `vpn-service-e2e-${process.pid}.db`);
process.env.E2E_DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] }
    }
  ],
  webServer: {
    command: `node scripts/migrate.mjs && ./node_modules/.bin/vite dev --host ${host} --port ${port} --strictPort`,
    url: `${baseURL}/health/live`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_BASE_URL: baseURL,
      PUBLIC_TELEGRAM_BOT_USERNAME: 'example_vpn_bot',
      TELEGRAM_BOT_TOKEN: '123456789:abcdefghijklmnopqrstuvwxyzABCDE',
      TELEGRAM_WEBHOOK_SECRET: 'telegram-webhook-secret-at-least-32',
      STRIPE_SECRET_KEY: 'sk_test_example_only_not_a_secret',
      STRIPE_WEBHOOK_SECRET: 'whsec_example_only',
      STRIPE_API_VERSION: '2026-06-30.dahlia',
      PAYMENT_CURRENCY: 'eur',
      STRIPE_LIVEMODE_ALLOWED: 'false',
      ADMIN_TELEGRAM_CHAT_ID: '123456789',
      SUPPORT_CHAT_ID: '',
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: 'session-secret-at-least-thirty-two-characters',
      DATA_ENCRYPTION_KEY: 'encryption-key-at-least-thirty-two-chars',
      MARZBAN_BASE_URL: 'http://127.0.0.1:8000',
      MARZBAN_ADMIN_USERNAME: 'admin',
      MARZBAN_ADMIN_PASSWORD: 'example-password',
      MARZBAN_VLESS_INBOUND_TAGS: 'VLESS_TCP_REALITY',
      SUBSCRIPTION_PUBLIC_BASE_URL: 'http://127.0.0.1:8080',
      LOG_LEVEL: 'info',
      NODE_ENV: 'test'
    }
  }
});
