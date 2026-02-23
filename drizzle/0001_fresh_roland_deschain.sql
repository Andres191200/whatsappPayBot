CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_jid` text NOT NULL,
	`group_jid` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `user_tokens` (
	`user_jid` text PRIMARY KEY NOT NULL,
	`mp_access_token` text NOT NULL,
	`mp_refresh_token` text,
	`mp_user_id` text,
	`mp_public_key` text,
	`expires_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `debts` ADD `mp_payment_id` text;--> statement-breakpoint
ALTER TABLE `debts` ADD `mp_preference_id` text;