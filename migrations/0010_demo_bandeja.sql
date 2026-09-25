CREATE TABLE `demo_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`text` text NOT NULL,
	`html` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `demo_outbox_to` ON `demo_outbox` (`to`,`created_at`);