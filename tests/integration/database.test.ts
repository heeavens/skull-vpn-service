import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../../src/lib/server/db/client';

const temporaryDirectories: string[] = [];

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'vpn-db-test-'));
  temporaryDirectories.push(directory);
  return join(directory, 'app.db');
}

function migrate(databaseUrl: string): void {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('database migration', () => {
  it('applies twice to a clean SQLite database', () => {
    const databaseUrl = createDatabasePath();

    migrate(databaseUrl);
    migrate(databaseUrl);

    const { sqlite, close } = openDatabase(databaseUrl);
    try {
      const tableNames = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tableNames).toEqual(
        expect.arrayContaining([
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
        ])
      );
      expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    } finally {
      close();
    }
  });

  it('enforces unique users and session foreign keys', () => {
    const databaseUrl = createDatabasePath();
    migrate(databaseUrl);

    const { sqlite, close } = openDatabase(databaseUrl);
    try {
      const now = Date.now();
      const insertUser = sqlite.prepare(
        'INSERT INTO users (id, telegram_user_id, first_name, last_auth_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      insertUser.run('user-1', '100001', 'Ada', now, now, now);

      expect(() => insertUser.run('user-2', '100001', 'Grace', now, now, now)).toThrowError(
        /UNIQUE constraint failed/
      );
      expect(() =>
        sqlite
          .prepare(
            'INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run('token-hash', 'missing-user', now + 1_000, now, now)
      ).toThrowError(/FOREIGN KEY constraint failed/);
    } finally {
      close();
    }
  });

  it('enforces price, order amount, and job idempotency constraints', () => {
    const databaseUrl = createDatabasePath();
    migrate(databaseUrl);

    const { sqlite, close } = openDatabase(databaseUrl);
    try {
      const now = Date.now();
      const insertPlan = sqlite.prepare(
        'INSERT INTO plans (id, slug, name, duration_days, price_amount_minor, currency, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      expect(() =>
        insertPlan.run('invalid-plan', 'invalid', 'Invalid', 30, null, 'eur', 0, 1, now, now)
      ).toThrowError(/CHECK constraint failed/);

      insertPlan.run('plan-1', 'starter', 'Starter', 30, 1_000, 'eur', 0, 1, now, now);
      sqlite
        .prepare(
          'INSERT INTO users (id, telegram_user_id, first_name, last_auth_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('user-1', '100001', 'Ada', now, now, now);

      expect(() =>
        sqlite
          .prepare(
            'INSERT INTO orders (id, user_id, plan_id, plan_name_snapshot, duration_days_snapshot, base_amount_minor, discount_amount_minor, total_amount_minor, currency, status, terms_version, terms_accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            'order-1',
            'user-1',
            'plan-1',
            'Starter',
            30,
            1_000,
            100,
            950,
            'eur',
            'pending',
            '1.0',
            now,
            now,
            now
          )
      ).toThrowError(/CHECK constraint failed/);

      const insertJob = sqlite.prepare(
        'INSERT INTO jobs (id, type, payload_json, idempotency_key, status, max_attempts, run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      insertJob.run(
        'job-1',
        'vpn.provision.v1',
        '{"orderId":"order-1"}',
        'vpn.provision:order-1',
        'pending',
        3,
        now,
        now,
        now
      );
      expect(() =>
        insertJob.run(
          'job-2',
          'vpn.provision.v1',
          '{"orderId":"order-1"}',
          'vpn.provision:order-1',
          'pending',
          3,
          now,
          now,
          now
        )
      ).toThrowError(/UNIQUE constraint failed/);
    } finally {
      close();
    }
  });
});
