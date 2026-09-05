CREATE TABLE `device_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `device_commands_device_status_idx` ON `device_commands` (`device_id`,`status`);--> statement-breakpoint
CREATE INDEX `device_commands_user_created_idx` ON `device_commands` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `device_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`type` text NOT NULL,
	`platform` text DEFAULT 'unknown' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `device_events_user_created_idx` ON `device_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `device_events_device_created_idx` ON `device_events` (`device_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `device_pairings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`token_hash` text,
	`device_name` text DEFAULT '浏览器助手' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_pairings_code_hash_uidx` ON `device_pairings` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_pairings_token_hash_uidx` ON `device_pairings` (`token_hash`);--> statement-breakpoint
CREATE INDEX `device_pairings_user_created_idx` ON `device_pairings` (`user_id`,`created_at`);