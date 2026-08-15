import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  loadConfig,
  loadWebAppConfig,
  loadWorkerConfig
} from '$lib/server/config/schema';
import { validEnvironment } from '../helpers/config';

describe('configuration validation', () => {
  it('keeps the documented environment example structurally valid', () => {
    const example = parse(readFileSync(resolve(process.cwd(), '.env.example')));

    expect(() => loadConfig(example)).not.toThrow();
  });

  it('normalizes a valid environment without exposing secrets', () => {
    const config = loadConfig(validEnvironment());

    expect(config.paymentCurrency).toBe('eur');
    expect(config.stripeLivemodeAllowed).toBe(false);
    expect(config.supportChatId).toBe(config.adminTelegramChatId);
    expect(config.marzbanVlessInboundTags).toEqual(['VLESS_TCP_REALITY', 'VLESS_WS']);
  });

  it('rejects a live Stripe key', () => {
    const liveKey = 'sk_live_canary-that-must-never-appear';

    expect(() => loadConfig(validEnvironment({ STRIPE_SECRET_KEY: liveKey }))).toThrowError(
      ConfigError
    );

    try {
      loadConfig(validEnvironment({ STRIPE_SECRET_KEY: liveKey }));
    } catch (error) {
      expect(String(error)).not.toContain(liveKey);
    }
  });

  it('reports missing field names without their values', () => {
    expect(() => loadConfig(validEnvironment({ TELEGRAM_BOT_TOKEN: undefined }))).toThrowError(
      /TELEGRAM_BOT_TOKEN/
    );
  });

  it('rejects secret reuse across trust boundaries without exposing the value', () => {
    const reusedSecret = 'whsec_shared-secret-value-at-least-32-characters';

    expect(() =>
      loadConfig(
        validEnvironment({
          SESSION_SECRET: reusedSecret,
          STRIPE_WEBHOOK_SECRET: reusedSecret
        })
      )
    ).toThrowError(/SESSION_SECRET, STRIPE_WEBHOOK_SECRET/);

    try {
      loadConfig(
        validEnvironment({
          SESSION_SECRET: reusedSecret,
          STRIPE_WEBHOOK_SECRET: reusedSecret
        })
      );
    } catch (error) {
      expect(String(error)).not.toContain(reusedSecret);
    }
  });

  it('requires public HTTPS URLs in production', () => {
    expect(() =>
      loadConfig(
        validEnvironment({
          APP_BASE_URL: 'http://app.example.test',
          NODE_ENV: 'production'
        })
      )
    ).toThrowError(/APP_BASE_URL/);
  });

  it.each(['0', '-42', '00123'])('rejects a non-canonical admin user ID', (adminId) => {
    expect(() => loadConfig(validEnvironment({ ADMIN_TELEGRAM_CHAT_ID: adminId }))).toThrowError(
      /ADMIN_TELEGRAM_CHAT_ID/
    );
  });

  it('allows a signed support group ID without treating it as the admin identity', () => {
    const config = loadConfig(validEnvironment({ SUPPORT_CHAT_ID: '-1001234567890' }));

    expect(config.adminTelegramChatId).toBe('123456789');
    expect(config.supportChatId).toBe('-1001234567890');
  });

  it('rejects unsupported Marzban URL protocols', () => {
    expect(() =>
      loadConfig(validEnvironment({ MARZBAN_BASE_URL: 'file:///etc/passwd' }))
    ).toThrowError(/MARZBAN_BASE_URL/);
  });

  it.each([':memory:', 'data/app.db'])(
    'requires a persistent absolute production database',
    (url) => {
      expect(() =>
        loadConfig(validEnvironment({ DATABASE_URL: url, NODE_ENV: 'production' }))
      ).toThrowError(/DATABASE_URL/);
    }
  );

  it('does not expose Marzban credentials to the web process config', () => {
    const config = loadWebAppConfig(
      validEnvironment({
        MARZBAN_BASE_URL: undefined,
        MARZBAN_ADMIN_USERNAME: undefined,
        MARZBAN_ADMIN_PASSWORD: undefined,
        MARZBAN_VLESS_INBOUND_TAGS: undefined
      })
    );

    expect(config).not.toHaveProperty('marzbanAdminPassword');
  });

  it('does not require Stripe or session secrets in the worker process config', () => {
    const config = loadWorkerConfig(
      validEnvironment({
        STRIPE_SECRET_KEY: undefined,
        STRIPE_WEBHOOK_SECRET: undefined,
        STRIPE_API_VERSION: undefined,
        SESSION_SECRET: undefined
      })
    );

    expect(config).not.toHaveProperty('stripeSecretKey');
    expect(config).not.toHaveProperty('sessionSecret');
  });
});
