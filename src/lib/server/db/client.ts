import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseClient {
  readonly db: AppDatabase;
  readonly sqlite: BetterSqlite3.Database;
  close(): void;
}

export function openDatabase(databaseUrl: string): DatabaseClient {
  const sqlite = new BetterSqlite3(databaseUrl);

  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');

    return {
      db: drizzle(sqlite, { schema }),
      sqlite,
      close: () => sqlite.close()
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
