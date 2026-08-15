CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`diff_json` text,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_entity_type_entity_id_idx` ON `admin_audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_at_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `faq_items` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sort_order` integer NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "faq_items_is_active_boolean_check" CHECK("faq_items"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer NOT NULL,
	`run_at` integer NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`last_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "jobs_status_check" CHECK("jobs"."status" IN ('pending', 'processing', 'succeeded', 'failed')),
	CONSTRAINT "jobs_attempts_check" CHECK("jobs"."attempts" >= 0),
	CONSTRAINT "jobs_max_attempts_check" CHECK("jobs"."max_attempts" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_status_run_at_idx` ON `jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE INDEX `jobs_locked_at_idx` ON `jobs` (`locked_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`promo_code_id` text,
	`plan_name_snapshot` text NOT NULL,
	`duration_days_snapshot` integer NOT NULL,
	`base_amount_minor` integer NOT NULL,
	`discount_amount_minor` integer DEFAULT 0 NOT NULL,
	`total_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`stripe_checkout_session_id` text,
	`checkout_expires_at` integer,
	`terms_version` text NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_duration_days_snapshot_check" CHECK("orders"."duration_days_snapshot" > 0),
	CONSTRAINT "orders_amounts_check" CHECK("orders"."total_amount_minor" = "orders"."base_amount_minor" - "orders"."discount_amount_minor" AND "orders"."total_amount_minor" > 0),
	CONSTRAINT "orders_currency_check" CHECK("orders"."currency" = 'eur'),
	CONSTRAINT "orders_status_check" CHECK("orders"."status" IN ('pending', 'checkout_created', 'paid', 'cancelled', 'failed', 'refunded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_checkout_session_id_unique` ON `orders` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `orders_user_id_created_at_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_checkout_expires_at_idx` ON `orders` (`status`,`checkout_expires_at`);--> statement-breakpoint
CREATE INDEX `orders_promo_code_id_idx` ON `orders` (`promo_code_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`stripe_checkout_session_id` text NOT NULL,
	`stripe_payment_intent_id` text NOT NULL,
	`stripe_event_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount_total_minor` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`refunded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_currency_check" CHECK("payments"."currency" = 'eur')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order_id_unique` ON `payments` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_stripe_checkout_session_id_unique` ON `payments` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_stripe_payment_intent_id_unique` ON `payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_stripe_event_id_unique` ON `payments` (`stripe_event_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_days` integer NOT NULL,
	`price_amount_minor` integer,
	`currency` text DEFAULT 'eur' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "plans_duration_days_check" CHECK("plans"."duration_days" > 0),
	CONSTRAINT "plans_price_amount_minor_check" CHECK("plans"."price_amount_minor" IS NULL OR "plans"."price_amount_minor" > 0),
	CONSTRAINT "plans_currency_check" CHECK("plans"."currency" = 'eur'),
	CONSTRAINT "plans_is_active_boolean_check" CHECK("plans"."is_active" IN (0, 1)),
	CONSTRAINT "plans_active_price_check" CHECK("plans"."is_active" = 0 OR ("plans"."price_amount_minor" IS NOT NULL AND "plans"."price_amount_minor" > 0 AND "plans"."currency" = 'eur'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_slug_unique` ON `plans` (`slug`);--> statement-breakpoint
CREATE INDEX `plans_is_active_sort_order_idx` ON `plans` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `plans_archived_at_idx` ON `plans` (`archived_at`);--> statement-breakpoint
CREATE TABLE `promo_code_plans` (
	`promo_code_id` text NOT NULL,
	`plan_id` text NOT NULL,
	PRIMARY KEY(`promo_code_id`, `plan_id`),
	FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_normalized` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`max_redemptions` integer,
	`max_per_user` integer DEFAULT 1 NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "promo_codes_discount_type_check" CHECK("promo_codes"."discount_type" IN ('percent', 'fixed_amount')),
	CONSTRAINT "promo_codes_discount_value_check" CHECK("promo_codes"."discount_value" > 0),
	CONSTRAINT "promo_codes_percent_value_check" CHECK("promo_codes"."discount_type" <> 'percent' OR "promo_codes"."discount_value" <= 100),
	CONSTRAINT "promo_codes_max_redemptions_check" CHECK("promo_codes"."max_redemptions" IS NULL OR "promo_codes"."max_redemptions" > 0),
	CONSTRAINT "promo_codes_max_per_user_check" CHECK("promo_codes"."max_per_user" > 0),
	CONSTRAINT "promo_codes_is_active_boolean_check" CHECK("promo_codes"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_codes_code_normalized_unique` ON `promo_codes` (`code_normalized`);--> statement-breakpoint
CREATE INDEX `promo_codes_is_active_idx` ON `promo_codes` (`is_active`);--> statement-breakpoint
CREATE INDEX `promo_codes_ends_at_idx` ON `promo_codes` (`ends_at`);--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`promo_code_id` text,
	`user_id` text,
	`order_id` text,
	`redeemed_at` integer NOT NULL,
	FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_redemptions_order_id_unique` ON `promo_redemptions` (`order_id`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_promo_code_id_idx` ON `promo_redemptions` (`promo_code_id`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_user_id_promo_code_id_idx` ON `promo_redemptions` (`user_id`,`promo_code_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`stripe_object_id` text,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`processed_at` integer,
	CONSTRAINT "stripe_webhook_events_status_check" CHECK("stripe_webhook_events"."status" IN ('received', 'processed', 'ignored', 'failed'))
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`current_plan_id` text,
	`marzban_username` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` integer,
	`expires_at` integer,
	`subscription_url_encrypted` text,
	`last_synced_at` integer,
	`last_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subscriptions_status_check" CHECK("subscriptions"."status" IN ('pending_activation', 'active', 'expired', 'suspended', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_unique` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_marzban_username_unique` ON `subscriptions` (`marzban_username`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_expires_at_idx` ON `subscriptions` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`notification_status` text NOT NULL,
	`telegram_message_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "support_tickets_status_check" CHECK("support_tickets"."status" IN ('open', 'in_progress', 'closed')),
	CONSTRAINT "support_tickets_notification_status_check" CHECK("support_tickets"."notification_status" IN ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `support_tickets_user_id_created_at_idx` ON `support_tickets` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`);--> statement-breakpoint
CREATE INDEX `support_tickets_notification_status_idx` ON `support_tickets` (`notification_status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_user_id` text NOT NULL,
	`username` text,
	`first_name` text NOT NULL,
	`last_name` text,
	`photo_url` text,
	`language_code` text,
	`last_auth_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_user_id_unique` ON `users` (`telegram_user_id`);