import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const boolean = (name: string) => integer(name, { mode: 'boolean' });

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    telegramUserId: text('telegram_user_id').notNull(),
    username: text('username'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    photoUrl: text('photo_url'),
    languageCode: text('language_code'),
    lastAuthAt: timestamp('last_auth_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
  },
  (table) => [uniqueIndex('users_telegram_user_id_unique').on(table.telegramUserId)]
);

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull()
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt)
  ]
);

export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    durationDays: integer('duration_days').notNull(),
    priceAmountMinor: integer('price_amount_minor'),
    currency: text('currency').notNull().default('eur'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    archivedAt: timestamp('archived_at')
  },
  (table) => [
    uniqueIndex('plans_slug_unique').on(table.slug),
    index('plans_is_active_sort_order_idx').on(table.isActive, table.sortOrder),
    index('plans_archived_at_idx').on(table.archivedAt),
    check('plans_duration_days_check', sql`${table.durationDays} > 0`),
    check(
      'plans_price_amount_minor_check',
      sql`${table.priceAmountMinor} IS NULL OR ${table.priceAmountMinor} > 0`
    ),
    check('plans_currency_check', sql`${table.currency} = 'eur'`),
    check('plans_is_active_boolean_check', sql`${table.isActive} IN (0, 1)`),
    check(
      'plans_active_price_check',
      sql`${table.isActive} = 0 OR (${table.priceAmountMinor} IS NOT NULL AND ${table.priceAmountMinor} > 0 AND ${table.currency} = 'eur')`
    )
  ]
);

export const promoCodes = sqliteTable(
  'promo_codes',
  {
    id: text('id').primaryKey(),
    codeNormalized: text('code_normalized').notNull(),
    discountType: text('discount_type').notNull(),
    discountValue: integer('discount_value').notNull(),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    maxRedemptions: integer('max_redemptions'),
    maxPerUser: integer('max_per_user').notNull().default(1),
    isActive: boolean('is_active').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    archivedAt: timestamp('archived_at')
  },
  (table) => [
    uniqueIndex('promo_codes_code_normalized_unique').on(table.codeNormalized),
    index('promo_codes_is_active_idx').on(table.isActive),
    index('promo_codes_ends_at_idx').on(table.endsAt),
    check(
      'promo_codes_discount_type_check',
      sql`${table.discountType} IN ('percent', 'fixed_amount')`
    ),
    check('promo_codes_discount_value_check', sql`${table.discountValue} > 0`),
    check(
      'promo_codes_percent_value_check',
      sql`${table.discountType} <> 'percent' OR ${table.discountValue} <= 100`
    ),
    check(
      'promo_codes_max_redemptions_check',
      sql`${table.maxRedemptions} IS NULL OR ${table.maxRedemptions} > 0`
    ),
    check('promo_codes_max_per_user_check', sql`${table.maxPerUser} > 0`),
    check('promo_codes_is_active_boolean_check', sql`${table.isActive} IN (0, 1)`)
  ]
);

export const promoCodePlans = sqliteTable(
  'promo_code_plans',
  {
    promoCodeId: text('promo_code_id')
      .notNull()
      .references(() => promoCodes.id),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id)
  },
  (table) => [
    primaryKey({
      columns: [table.promoCodeId, table.planId],
      name: 'promo_code_plans_promo_code_id_plan_id_pk'
    })
  ]
);

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    promoCodeId: text('promo_code_id').references(() => promoCodes.id),
    planNameSnapshot: text('plan_name_snapshot').notNull(),
    durationDaysSnapshot: integer('duration_days_snapshot').notNull(),
    baseAmountMinor: integer('base_amount_minor').notNull(),
    discountAmountMinor: integer('discount_amount_minor').notNull().default(0),
    totalAmountMinor: integer('total_amount_minor').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    checkoutExpiresAt: timestamp('checkout_expires_at'),
    termsVersion: text('terms_version').notNull(),
    termsAcceptedAt: timestamp('terms_accepted_at').notNull(),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('orders_stripe_checkout_session_id_unique').on(table.stripeCheckoutSessionId),
    index('orders_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('orders_status_checkout_expires_at_idx').on(table.status, table.checkoutExpiresAt),
    index('orders_promo_code_id_idx').on(table.promoCodeId),
    check('orders_duration_days_snapshot_check', sql`${table.durationDaysSnapshot} > 0`),
    check(
      'orders_amounts_check',
      sql`${table.totalAmountMinor} = ${table.baseAmountMinor} - ${table.discountAmountMinor} AND ${table.totalAmountMinor} > 0`
    ),
    check('orders_currency_check', sql`${table.currency} = 'eur'`),
    check(
      'orders_status_check',
      sql`${table.status} IN ('pending', 'checkout_created', 'paid', 'cancelled', 'failed', 'refunded')`
    )
  ]
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').references(() => orders.id),
    stripeCheckoutSessionId: text('stripe_checkout_session_id').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
    stripeEventId: text('stripe_event_id').notNull(),
    currency: text('currency').notNull(),
    amountTotalMinor: integer('amount_total_minor').notNull(),
    paidAt: timestamp('paid_at').notNull(),
    refundedAt: timestamp('refunded_at'),
    createdAt: timestamp('created_at').notNull()
  },
  (table) => [
    uniqueIndex('payments_order_id_unique').on(table.orderId),
    uniqueIndex('payments_stripe_checkout_session_id_unique').on(table.stripeCheckoutSessionId),
    uniqueIndex('payments_stripe_payment_intent_id_unique').on(table.stripePaymentIntentId),
    uniqueIndex('payments_stripe_event_id_unique').on(table.stripeEventId),
    check('payments_currency_check', sql`${table.currency} = 'eur'`)
  ]
);

export const stripeWebhookEvents = sqliteTable(
  'stripe_webhook_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    stripeObjectId: text('stripe_object_id'),
    status: text('status').notNull(),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at').notNull(),
    processedAt: timestamp('processed_at')
  },
  (table) => [
    check(
      'stripe_webhook_events_status_check',
      sql`${table.status} IN ('received', 'processed', 'ignored', 'failed')`
    )
  ]
);

export const promoRedemptions = sqliteTable(
  'promo_redemptions',
  {
    id: text('id').primaryKey(),
    promoCodeId: text('promo_code_id').references(() => promoCodes.id),
    userId: text('user_id').references(() => users.id),
    orderId: text('order_id').references(() => orders.id),
    redeemedAt: timestamp('redeemed_at').notNull()
  },
  (table) => [
    uniqueIndex('promo_redemptions_order_id_unique').on(table.orderId),
    index('promo_redemptions_promo_code_id_idx').on(table.promoCodeId),
    index('promo_redemptions_user_id_promo_code_id_idx').on(table.userId, table.promoCodeId)
  ]
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    currentPlanId: text('current_plan_id').references(() => plans.id),
    marzbanUsername: text('marzban_username').notNull(),
    status: text('status').notNull(),
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    subscriptionUrlEncrypted: text('subscription_url_encrypted'),
    lastSyncedAt: timestamp('last_synced_at'),
    lastErrorCode: text('last_error_code'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('subscriptions_user_id_unique').on(table.userId),
    uniqueIndex('subscriptions_marzban_username_unique').on(table.marzbanUsername),
    index('subscriptions_status_expires_at_idx').on(table.status, table.expiresAt),
    check(
      'subscriptions_status_check',
      sql`${table.status} IN ('pending_activation', 'active', 'expired', 'suspended', 'error')`
    )
  ]
);

export const faqItems = sqliteTable(
  'faq_items',
  {
    id: text('id').primaryKey(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    sortOrder: integer('sort_order').notNull(),
    isActive: boolean('is_active').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    archivedAt: timestamp('archived_at')
  },
  (table) => [check('faq_items_is_active_boolean_check', sql`${table.isActive} IN (0, 1)`)]
);

export const supportTickets = sqliteTable(
  'support_tickets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    category: text('category').notNull(),
    message: text('message').notNull(),
    status: text('status').notNull(),
    notificationStatus: text('notification_status').notNull(),
    telegramMessageId: text('telegram_message_id'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    closedAt: timestamp('closed_at')
  },
  (table) => [
    index('support_tickets_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('support_tickets_status_idx').on(table.status),
    index('support_tickets_notification_status_idx').on(table.notificationStatus),
    check(
      'support_tickets_status_check',
      sql`${table.status} IN ('open', 'in_progress', 'closed')`
    ),
    check(
      'support_tickets_notification_status_check',
      sql`${table.notificationStatus} IN ('pending', 'sent', 'failed')`
    )
  ]
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payloadJson: text('payload_json').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull(),
    runAt: timestamp('run_at').notNull(),
    lockedAt: timestamp('locked_at'),
    lockedBy: text('locked_by'),
    lastErrorCode: text('last_error_code'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('jobs_idempotency_key_unique').on(table.idempotencyKey),
    index('jobs_status_run_at_idx').on(table.status, table.runAt),
    index('jobs_locked_at_idx').on(table.lockedAt),
    check(
      'jobs_status_check',
      sql`${table.status} IN ('pending', 'processing', 'succeeded', 'failed')`
    ),
    check('jobs_attempts_check', sql`${table.attempts} >= 0`),
    check('jobs_max_attempts_check', sql`${table.maxAttempts} > 0`)
  ]
);

export const adminAuditLog = sqliteTable(
  'admin_audit_log',
  {
    id: text('id').primaryKey(),
    adminUserId: text('admin_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    diffJson: text('diff_json'),
    requestId: text('request_id').notNull(),
    createdAt: timestamp('created_at').notNull()
  },
  (table) => [
    index('admin_audit_log_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    index('admin_audit_log_created_at_idx').on(table.createdAt)
  ]
);
