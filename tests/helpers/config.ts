export function validEnvironment(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    APP_BASE_URL: 'https://app.example.test',
    ADDRESS_HEADER: 'X-Forwarded-For',
    XFF_DEPTH: '1',
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
    DATABASE_URL: '/private/tmp/vpn-service-test.db',
    SESSION_SECRET: 'session-secret-at-least-thirty-two-characters',
    DATA_ENCRYPTION_KEY: 'encryption-key-at-least-thirty-two-chars',
    MARZBAN_BASE_URL: 'http://marzban.test:8000',
    MARZBAN_ADMIN_USERNAME: 'admin',
    MARZBAN_ADMIN_PASSWORD: 'example-password',
    MARZBAN_VLESS_INBOUND_TAGS: 'VLESS_TCP_REALITY,VLESS_WS',
    SUBSCRIPTION_PUBLIC_BASE_URL: 'https://sub.example.test',
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
    ...overrides
  };
}
