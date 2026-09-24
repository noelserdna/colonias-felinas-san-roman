CREATE TABLE `attempt_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` text NOT NULL,
	`position` integer NOT NULL,
	`question_id` integer NOT NULL,
	`snapshot` text NOT NULL,
	`option_order` text,
	`answer` text,
	`is_correct` integer,
	`jev_score` real,
	`jev_confidence` real,
	`jev_flag` real,
	`jev_raw` text,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_items_pos` ON `attempt_items` (`attempt_id`,`position`);--> statement-breakpoint
CREATE INDEX `attempt_items_q` ON `attempt_items` (`question_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`unit_id` integer,
	`status` text NOT NULL,
	`pass_pct` real NOT NULL,
	`score_pct` real,
	`correct_count` integer,
	`total_count` integer NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`grading_tries` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attempts_user` ON `attempts` (`user_id`,`kind`,`status`);--> statement-breakpoint
CREATE TABLE `carnets` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`user_id` text NOT NULL,
	`nombre` text NOT NULL,
	`apellidos` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`attempt_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carnets_numero_unique` ON `carnets` (`numero`);--> statement-breakpoint
CREATE TABLE `counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `magic_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer NOT NULL,
	`type` text NOT NULL,
	`enunciado` text NOT NULL,
	`options` text,
	`correct_index` integer,
	`explicacion` text,
	`reference_answer` text,
	`key_points` text,
	`activo` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_unit_type` ON `questions` (`unit_id`,`type`,`activo`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`orden` integer NOT NULL,
	`titulo` text NOT NULL,
	`contenido` text NOT NULL,
	`peso` real DEFAULT 1 NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_slug_unique` ON `units` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text,
	`apellidos` text,
	`role` text DEFAULT 'user' NOT NULL,
	`consent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);