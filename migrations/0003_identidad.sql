CREATE TABLE `assets` (
	`key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`data_b64` text NOT NULL,
	`version` text NOT NULL,
	`updated_at` integer NOT NULL
);
