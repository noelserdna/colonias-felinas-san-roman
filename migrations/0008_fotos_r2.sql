PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`colony_id` text NOT NULL,
	`cat_id` text,
	`note_id` text,
	`content_type` text NOT NULL,
	`storage_key` text,
	`data_b64` text,
	`bytes` integer NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`colony_id`) REFERENCES `colonies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cat_id`) REFERENCES `colony_cats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `cat_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_photos`("id", "colony_id", "cat_id", "note_id", "content_type", "storage_key", "data_b64", "bytes", "user_id", "created_at") SELECT "id", "colony_id", "cat_id", "note_id", "content_type", NULL, "data_b64", "bytes", "user_id", "created_at" FROM `photos`;--> statement-breakpoint
DROP TABLE `photos`;--> statement-breakpoint
ALTER TABLE `__new_photos` RENAME TO `photos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `photos_cat` ON `photos` (`cat_id`);--> statement-breakpoint
CREATE INDEX `photos_note` ON `photos` (`note_id`);