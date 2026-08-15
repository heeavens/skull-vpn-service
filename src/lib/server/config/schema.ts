import { isAbsolute } from 'node:path';
import { z } from 'zod';

const identifier = z.string().trim().min(1).max(128);
const secret = z.string().min(32).max(1024);
const telegramUserId = z.string().regex(/^[1-9]\d*$/, 'must be a positive Telegram user ID');
const telegramChatId = z.string().regex(/^-?[1-9]\d*$/, 'must be a canonical Telegram chat ID');
const httpUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'must use HTTP or HTTPS');

const environmentShape = {
  APP_BASE_URL: httpUrl,
  ADDRESS_HEADER: z.literal('X-Forwarded-For'),
  XFF_DEPTH: z.literal('1').transform(() => 1 as const),
  PUBLIC_TELEGRAM_BOT_USERNAME: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{5,32}$/, 'must be a Telegram bot username without @'),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[A-Za-z0-9_-]{20,}$/, 'must have the Telegram bot token format'),
  TELEGRAM_WEBHOOK_SECRET: secret,
  STRIPE_SECRET_KEY: z.string().startsWith('sk_test_', 'must be a Stripe test secret key'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').min(12).max(512),
  STRIPE_API_VERSION: z.string().regex(/^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/),
  PAYMENT_CURRENCY: z.literal('eur').default('eur'),
  STRIPE_LIVEMODE_ALLOWED: z
    .enum(['false'])
    .default('false')
    .transform(() => false as const),
  ADMIN_TELEGRAM_CHAT_ID: telegramUserId,
  SUPPORT_CHAT_ID: z.union([telegramChatId, z.literal('')]).optional(),
  DATABASE_URL: z.string().trim().min(1).max(1024),
  SESSION_SECRET: secret,
  DATA_ENCRYPTION_KEY: secret,
  MARZBAN_BASE_URL: httpUrl,
  MARZBAN_ADMIN_USERNAME: identifier,
  MARZBAN_ADMIN_PASSWORD: z.string().min(1).max(1024),
  MARZBAN_VLESS_INBOUND_TAGS: z.string().trim().min(1).max(2048),
  SUBSCRIPTION_PUBLIC_BASE_URL: httpUrl,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production'])
};

const baseEnvironmentSchema = z.object(environmentShape);

const webEnvironmentSchema = baseEnvironmentSchema
  .pick({
    APP_BASE_URL: true,
    ADDRESS_HEADER: true,
    XFF_DEPTH: true,
    PUBLIC_TELEGRAM_BOT_USERNAME: true,
    TELEGRAM_BOT_TOKEN: true,
    TELEGRAM_WEBHOOK_SECRET: true,
    STRIPE_SECRET_KEY: true,
    STRIPE_WEBHOOK_SECRET: true,
    STRIPE_API_VERSION: true,
    PAYMENT_CURRENCY: true,
    STRIPE_LIVEMODE_ALLOWED: true,
    ADMIN_TELEGRAM_CHAT_ID: true,
    SUPPORT_CHAT_ID: true,
    DATABASE_URL: true,
    SESSION_SECRET: true,
    DATA_ENCRYPTION_KEY: true,
    SUBSCRIPTION_PUBLIC_BASE_URL: true,
    LOG_LEVEL: true,
    NODE_ENV: true
  })
  .superRefine(validateProductionRuntime)
  .superRefine(validateSecretSeparation);

const workerEnvironmentSchema = baseEnvironmentSchema
  .pick({
    APP_BASE_URL: true,
    TELEGRAM_BOT_TOKEN: true,
    ADMIN_TELEGRAM_CHAT_ID: true,
    SUPPORT_CHAT_ID: true,
    DATABASE_URL: true,
    DATA_ENCRYPTION_KEY: true,
    MARZBAN_BASE_URL: true,
    MARZBAN_ADMIN_USERNAME: true,
    MARZBAN_ADMIN_PASSWORD: true,
    MARZBAN_VLESS_INBOUND_TAGS: true,
    SUBSCRIPTION_PUBLIC_BASE_URL: true,
    LOG_LEVEL: true,
    NODE_ENV: true
  })
  .superRefine(validateProductionRuntime);

const environmentSchema = baseEnvironmentSchema
  .superRefine(validateProductionRuntime)
  .superRefine(validateSecretSeparation);

type RuntimeEnvironment = Readonly<{
  APP_BASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  ADMIN_TELEGRAM_CHAT_ID: string;
  SUPPORT_CHAT_ID?: string;
  DATABASE_URL: string;
  DATA_ENCRYPTION_KEY: string;
  SUBSCRIPTION_PUBLIC_BASE_URL: string;
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  NODE_ENV: 'development' | 'test' | 'production';
}>;

type CommonConfig = Readonly<{
  appBaseUrl: URL;
  telegramBotToken: string;
  adminTelegramChatId: string;
  supportChatId: string;
  databaseUrl: string;
  dataEncryptionKey: string;
  subscriptionPublicBaseUrl: URL;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  nodeEnv: 'development' | 'test' | 'production';
}>;

export type WebAppConfig = Readonly<
  CommonConfig & {
    publicTelegramBotUsername: string;
    telegramWebhookSecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    stripeApiVersion: string;
    paymentCurrency: 'eur';
    stripeLivemodeAllowed: false;
    sessionSecret: string;
    addressHeader: 'X-Forwarded-For';
    xffDepth: 1;
  }
>;

export type WorkerConfig = Readonly<
  CommonConfig & {
    marzbanBaseUrl: URL;
    marzbanAdminUsername: string;
    marzbanAdminPassword: string;
    marzbanVlessInboundTags: readonly string[];
  }
>;

export type AppConfig = Readonly<WebAppConfig & WorkerConfig>;

export class ConfigError extends Error {
  readonly code = 'CONFIG_INVALID';

  constructor(readonly fields: readonly string[]) {
    super(`Invalid configuration for: ${fields.join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const value = parseEnvironment(environmentSchema, source);
  return Object.freeze({
    ...toCommonConfig(value),
    ...toWebConfig(value),
    ...toWorkerConfig(value)
  });
}

export function loadWebAppConfig(source: Record<string, string | undefined>): WebAppConfig {
  const value = parseEnvironment(webEnvironmentSchema, source);
  return Object.freeze({
    ...toCommonConfig(value),
    ...toWebConfig(value)
  });
}

export function loadWorkerConfig(source: Record<string, string | undefined>): WorkerConfig {
  const value = parseEnvironment(workerEnvironmentSchema, source);
  return Object.freeze({
    ...toCommonConfig(value),
    ...toWorkerConfig(value)
  });
}

function validateProductionRuntime(value: RuntimeEnvironment, context: z.RefinementCtx): void {
  if (value.NODE_ENV !== 'production') return;

  if (!isAbsolute(value.DATABASE_URL) || value.DATABASE_URL === ':memory:') {
    context.addIssue({
      code: 'custom',
      path: ['DATABASE_URL'],
      message: 'must be an absolute persistent path in production'
    });
  }

  for (const [field, rawUrl] of [
    ['APP_BASE_URL', value.APP_BASE_URL],
    ['SUBSCRIPTION_PUBLIC_BASE_URL', value.SUBSCRIPTION_PUBLIC_BASE_URL]
  ] as const) {
    if (new URL(rawUrl).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: [field],
        message: 'must use HTTPS in production'
      });
    }
  }
}

function validateSecretSeparation(
  value: Partial<
    Record<
      | 'SESSION_SECRET'
      | 'DATA_ENCRYPTION_KEY'
      | 'TELEGRAM_WEBHOOK_SECRET'
      | 'STRIPE_WEBHOOK_SECRET',
      string
    >
  >,
  context: z.RefinementCtx
): void {
  const fields = [
    'SESSION_SECRET',
    'DATA_ENCRYPTION_KEY',
    'TELEGRAM_WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRET'
  ] as const;
  const fieldsByValue = new Map<string, (typeof fields)[number][]>();

  for (const field of fields) {
    const secretValue = value[field];
    if (!secretValue) continue;
    const matchingFields = fieldsByValue.get(secretValue) ?? [];
    matchingFields.push(field);
    fieldsByValue.set(secretValue, matchingFields);
  }

  for (const matchingFields of fieldsByValue.values()) {
    if (matchingFields.length < 2) continue;
    for (const field of matchingFields) {
      context.addIssue({
        code: 'custom',
        path: [field],
        message: 'must not be reused across trust boundaries'
      });
    }
  }
}

function parseEnvironment<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) =>
          issue.path.length > 0 ? String(issue.path[0]) : 'environment'
        )
      )
    ].sort();
    throw new ConfigError(fields);
  }

  return result.data;
}

function toCommonConfig(value: RuntimeEnvironment): CommonConfig {
  return {
    appBaseUrl: new URL(value.APP_BASE_URL),
    telegramBotToken: value.TELEGRAM_BOT_TOKEN,
    adminTelegramChatId: value.ADMIN_TELEGRAM_CHAT_ID,
    supportChatId: value.SUPPORT_CHAT_ID || value.ADMIN_TELEGRAM_CHAT_ID,
    databaseUrl: value.DATABASE_URL,
    dataEncryptionKey: value.DATA_ENCRYPTION_KEY,
    subscriptionPublicBaseUrl: new URL(value.SUBSCRIPTION_PUBLIC_BASE_URL),
    logLevel: value.LOG_LEVEL,
    nodeEnv: value.NODE_ENV
  };
}

function toWebConfig(
  value: z.infer<typeof webEnvironmentSchema>
): Omit<WebAppConfig, keyof CommonConfig> {
  return {
    publicTelegramBotUsername: value.PUBLIC_TELEGRAM_BOT_USERNAME,
    telegramWebhookSecret: value.TELEGRAM_WEBHOOK_SECRET,
    stripeSecretKey: value.STRIPE_SECRET_KEY,
    stripeWebhookSecret: value.STRIPE_WEBHOOK_SECRET,
    stripeApiVersion: value.STRIPE_API_VERSION,
    paymentCurrency: value.PAYMENT_CURRENCY,
    stripeLivemodeAllowed: value.STRIPE_LIVEMODE_ALLOWED,
    sessionSecret: value.SESSION_SECRET,
    addressHeader: value.ADDRESS_HEADER,
    xffDepth: value.XFF_DEPTH
  };
}

function toWorkerConfig(
  value: z.infer<typeof workerEnvironmentSchema>
): Omit<WorkerConfig, keyof CommonConfig> {
  const marzbanVlessInboundTags = [
    ...new Set(value.MARZBAN_VLESS_INBOUND_TAGS.split(',').map((tag) => tag.trim()))
  ].filter(Boolean);

  if (marzbanVlessInboundTags.length === 0) {
    throw new ConfigError(['MARZBAN_VLESS_INBOUND_TAGS']);
  }

  return {
    marzbanBaseUrl: new URL(value.MARZBAN_BASE_URL),
    marzbanAdminUsername: value.MARZBAN_ADMIN_USERNAME,
    marzbanAdminPassword: value.MARZBAN_ADMIN_PASSWORD,
    marzbanVlessInboundTags
  };
}
