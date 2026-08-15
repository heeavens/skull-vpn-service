import { describe, expect, it } from 'vitest';
import { TelegramInitDataError, verifyTelegramInitData } from '$lib/server/telegram/init-data';
import { createTelegramInitData, TEST_TELEGRAM_BOT_TOKEN } from '../helpers/telegram';

const now = new Date(1_700_000_000_000);

describe('Telegram Mini App init data verification', () => {
  it('returns a normalized user for authentic and fresh init data', () => {
    const rawInitData = createTelegramInitData();

    expect(verifyTelegramInitData(rawInitData, TEST_TELEGRAM_BOT_TOKEN, now)).toEqual({
      telegramUserId: '900719925474099',
      username: 'test_user',
      firstName: 'Test',
      lastName: 'User',
      photoUrl: 'https://example.test/avatar.jpg',
      languageCode: 'en',
      authDate: now
    });
  });

  it('accepts data at the five-minute freshness boundary', () => {
    const rawInitData = createTelegramInitData({ authDate: 1_699_999_700 });

    expect(verifyTelegramInitData(rawInitData, TEST_TELEGRAM_BOT_TOKEN, now).telegramUserId).toBe(
      '900719925474099'
    );
  });

  it('includes every received field except hash in signature verification', () => {
    const rawInitData = createTelegramInitData({
      additionalFields: { signature: 'telegram-ed25519-signature' }
    });

    expect(verifyTelegramInitData(rawInitData, TEST_TELEGRAM_BOT_TOKEN, now).firstName).toBe(
      'Test'
    );
  });

  it('rejects a forged payload', () => {
    const rawInitData = createTelegramInitData().replace('test_user', 'forged_user');

    expectInitDataFailure(rawInitData, 'INVALID');
  });

  it('rejects a payload signed for another bot', () => {
    const rawInitData = createTelegramInitData();

    expect(() =>
      verifyTelegramInitData(rawInitData, `999999:${'another-token'.repeat(3)}`, now)
    ).toThrow(TelegramInitDataError);
  });

  it('rejects expired init data', () => {
    const rawInitData = createTelegramInitData({ authDate: 1_699_999_699 });

    expectInitDataFailure(rawInitData, 'EXPIRED');
  });

  it('rejects init data dated in the future', () => {
    const rawInitData = createTelegramInitData({ authDate: 1_700_000_001 });

    expectInitDataFailure(rawInitData, 'EXPIRED');
  });

  it.each([
    '',
    'auth_date=1700000000&user=%7B%7D',
    'auth_date=not-a-number&user=%7B%7D&hash=not-a-hash',
    `${createTelegramInitData()}&hash=${'0'.repeat(64)}`
  ])('rejects malformed init data', (rawInitData) => {
    expectInitDataFailure(rawInitData, 'INVALID');
  });

  it('rejects a signed payload with an invalid user shape', () => {
    const rawInitData = createTelegramInitData({
      user: { id: 42, first_name: '' }
    });

    expectInitDataFailure(rawInitData, 'INVALID');
  });

  it('rejects signed user data that is not JSON', () => {
    const rawInitData = createTelegramInitData({ additionalFields: { user: 'not-json' } });

    expectInitDataFailure(rawInitData, 'INVALID');
  });
});

function expectInitDataFailure(rawInitData: string, reason: 'INVALID' | 'EXPIRED'): void {
  try {
    verifyTelegramInitData(rawInitData, TEST_TELEGRAM_BOT_TOKEN, now);
    throw new Error('Expected init data verification to fail');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(TelegramInitDataError);
    expect((error as TelegramInitDataError).reason).toBe(reason);
  }
}
