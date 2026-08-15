import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 5 * 60;

const telegramUserSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  username: z.string().min(1).optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1).optional(),
  photo_url: z.url().optional(),
  language_code: z.string().min(1).optional()
});

export type VerifiedTelegramUser = Readonly<{
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  authDate: Date;
}>;

export type TelegramInitDataFailure = 'INVALID' | 'EXPIRED';

export class TelegramInitDataError extends Error {
  constructor(readonly reason: TelegramInitDataFailure) {
    super(
      reason === 'EXPIRED' ? 'Telegram init data is not fresh' : 'Telegram init data is invalid'
    );
    this.name = 'TelegramInitDataError';
  }
}

export function verifyTelegramInitData(
  rawInitData: string,
  botToken: string,
  now: Date = new Date()
): VerifiedTelegramUser {
  const parameters = parseUniqueParameters(rawInitData);
  const suppliedHash = parameters.get('hash');

  if (!suppliedHash || !/^[a-f\d]{64}$/i.test(suppliedHash)) {
    throw new TelegramInitDataError('INVALID');
  }

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => compareTelegramKeys(left, right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const receivedHash = Buffer.from(suppliedHash, 'hex');

  if (receivedHash.length !== expectedHash.length || !timingSafeEqual(receivedHash, expectedHash)) {
    throw new TelegramInitDataError('INVALID');
  }

  const authDate = parseAuthDate(parameters.get('auth_date'));
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;

  if (ageSeconds < 0 || ageSeconds > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
    throw new TelegramInitDataError('EXPIRED');
  }

  const user = parseTelegramUser(parameters.get('user'));

  return {
    telegramUserId: String(user.id),
    username: user.username ?? null,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    photoUrl: user.photo_url ?? null,
    languageCode: user.language_code ?? null,
    authDate: new Date(authDate * 1000)
  };
}

function compareTelegramKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function parseUniqueParameters(rawInitData: string): URLSearchParams {
  if (rawInitData.length === 0) {
    throw new TelegramInitDataError('INVALID');
  }

  const parameters = new URLSearchParams(rawInitData);
  const uniqueKeys = new Set<string>();

  for (const key of parameters.keys()) {
    if (uniqueKeys.has(key)) {
      throw new TelegramInitDataError('INVALID');
    }

    uniqueKeys.add(key);
  }

  return parameters;
}

function parseAuthDate(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new TelegramInitDataError('INVALID');
  }

  const authDate = Number(value);
  if (!Number.isSafeInteger(authDate)) {
    throw new TelegramInitDataError('INVALID');
  }

  return authDate;
}

function parseTelegramUser(value: string | null): z.infer<typeof telegramUserSchema> {
  if (!value) {
    throw new TelegramInitDataError('INVALID');
  }

  try {
    const parsed: unknown = JSON.parse(value);
    const result = telegramUserSchema.safeParse(parsed);

    if (!result.success) {
      throw new TelegramInitDataError('INVALID');
    }

    return result.data;
  } catch (error: unknown) {
    if (error instanceof TelegramInitDataError) {
      throw error;
    }

    throw new TelegramInitDataError('INVALID');
  }
}
