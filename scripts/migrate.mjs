import 'dotenv/config';

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

function ensureDatabaseDirectory(databaseUrl) {
  if (databaseUrl === ':memory:') {
    return;
  }

  const directory = dirname(resolve(databaseUrl));
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

export function migrateDatabase({
  databaseUrl,
  migrationsFolder = resolve(process.cwd(), 'drizzle')
}) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  ensureDatabaseDirectory(databaseUrl);
  const sqlite = new BetterSqlite3(databaseUrl);

  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
    migrate(drizzle(sqlite), { migrationsFolder });
  } finally {
    sqlite.close();
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  migrateDatabase({ databaseUrl: process.env.DATABASE_URL });
}
