import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';

import { migrateDatabase } from './migrate.mjs';

const expectedTables = [
  'admin_audit_log',
  'faq_items',
  'jobs',
  'orders',
  'payments',
  'plans',
  'promo_code_plans',
  'promo_codes',
  'promo_redemptions',
  'sessions',
  'stripe_webhook_events',
  'subscriptions',
  'support_tickets',
  'users'
];

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'vpn-migrations-'));
const databaseUrl = join(temporaryDirectory, 'app.db');

try {
  migrateDatabase({ databaseUrl });
  migrateDatabase({ databaseUrl });

  const sqlite = new BetterSqlite3(databaseUrl, { readonly: true });
  try {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name)
      .filter((name) => name !== '__drizzle_migrations')
      .sort();

    if (JSON.stringify(tables) !== JSON.stringify(expectedTables)) {
      throw new Error('Migration did not create the expected schema');
    }

    const foreignKeyProblems = sqlite.pragma('foreign_key_check');
    if (foreignKeyProblems.length !== 0) {
      throw new Error('Migration produced invalid foreign keys');
    }
  } finally {
    sqlite.close();
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
