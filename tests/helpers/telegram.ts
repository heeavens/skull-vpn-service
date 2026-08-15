import { createHmac } from 'node:crypto';

export const TEST_TELEGRAM_BOT_TOKEN = `123456:${'test-token-value'.repeat(3)}`;

export type TelegramTestUser = Readonly<{
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
}>;

type TelegramInitDataFixture = Readonly<{
  botToken?: string;
  authDate?: number;
  user?: TelegramTestUser;
  queryId?: string;
  additionalFields?: Readonly<Record<string, string>>;
}>;

export function createTelegramInitData({
  botToken = TEST_TELEGRAM_BOT_TOKEN,
  authDate = 1_700_000_000,
  user = {
    id: 900719925474099,
    username: 'test_user',
    first_name: 'Test',
    last_name: 'User',
    photo_url: 'https://example.test/avatar.jpg',
    language_code: 'en'
  },
  queryId = 'AAHdF6IQAAAAAN0XohDhrOrc',
  additionalFields = {}
}: TelegramInitDataFixture = {}): string {
  const parameters = new URLSearchParams({
    auth_date: String(authDate),
    query_id: queryId,
    user: JSON.stringify(user)
  });

  for (const [key, value] of Object.entries(additionalFields)) {
    parameters.set(key, value);
  }

  const dataCheckString = [...parameters.entries()]
    .sort(([left], [right]) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  parameters.set('hash', hash);
  return parameters.toString();
}
