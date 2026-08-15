import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { loadWebAppConfig, type WebAppConfig } from './schema';

let cachedConfig: WebAppConfig | undefined;

export function getConfig(): WebAppConfig {
  cachedConfig ??= loadWebAppConfig({
    ...env,
    PUBLIC_TELEGRAM_BOT_USERNAME: publicEnv.PUBLIC_TELEGRAM_BOT_USERNAME
  });
  return cachedConfig;
}

export {
  ConfigError,
  loadConfig,
  loadWebAppConfig,
  loadWorkerConfig,
  type AppConfig,
  type WebAppConfig,
  type WorkerConfig
} from './schema';
