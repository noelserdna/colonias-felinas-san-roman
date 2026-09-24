CREATE TABLE `cat_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`user_id` text,
	`texto` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `colony_cats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cat_notes_cat` ON `cat_notes` (`cat_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`colony_id` text NOT NULL,
	`cat_id` text,
	`note_id` text,
	`content_type` text NOT NULL,
	`data_b64` text NOT NULL,
	`bytes` integer NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`colony_id`) REFERENCES `colonies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cat_id`) REFERENCES `colony_cats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `cat_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `photos_cat` ON `photos` (`cat_id`);--> statement-breakpoint
CREATE INDEX `photos_note` ON `photos` (`note_id`);--> statement-breakpoint
ALTER TABLE `colony_cats` ADD `photo_id` text;