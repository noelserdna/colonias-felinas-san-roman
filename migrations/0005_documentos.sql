CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titulo` text NOT NULL,
	`categoria` text NOT NULL,
	`descripcion` text,
	`url` text NOT NULL,
	`fecha` text,
	`orden` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
