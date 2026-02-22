CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`creditor_phone` text NOT NULL,
	`debtor_phone` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'ARS',
	`description` text,
	`status` text DEFAULT 'pending',
	`created_at` integer,
	`updated_at` integer,
	`paid_at` integer,
	`last_reminder_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creditor_phone`) REFERENCES `users`(`phone`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`debtor_phone`) REFERENCES `users`(`phone`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_jid` text NOT NULL,
	`name` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_whatsapp_jid_unique` ON `groups` (`whatsapp_jid`);--> statement-breakpoint
CREATE TABLE `users` (
	`phone` text PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` integer
);
