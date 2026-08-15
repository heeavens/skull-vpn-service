import { getConfig } from '$lib/server/config';
import { openDatabase } from '$lib/server/db/client';
import { UserSessionRepository } from '$lib/server/db/repositories/user-session-repository';
import { AuthService } from './session';

let service: AuthService | undefined;

export function getAuthService(): AuthService {
  if (service) {
    return service;
  }

  const config = getConfig();
  const database = openDatabase(config.databaseUrl);
  service = new AuthService(new UserSessionRepository(database.db), {
    telegramBotToken: config.telegramBotToken,
    adminTelegramChatId: config.adminTelegramChatId
  });

  return service;
}
