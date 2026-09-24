CREATE TABLE `cat_interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`fecha` text NOT NULL,
	`motivo` text NOT NULL,
	`clinica` text,
	`notas` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `colony_cats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cat_interventions_cat` ON `cat_interventions` (`cat_id`);--> statement-breakpoint
CREATE TABLE `colonies` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`nombre` text NOT NULL,
	`direccion` text NOT NULL,
	`coordenadas` text,
	`titularidad` text NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`notas` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `colonies_numero_unique` ON `colonies` (`numero`);--> statement-breakpoint
CREATE TABLE `colony_cats` (
	`id` text PRIMARY KEY NOT NULL,
	`colony_id` text NOT NULL,
	`nombre` text NOT NULL,
	`sexo` text NOT NULL,
	`edad` text,
	`descripcion` text,
	`esterilizado` integer DEFAULT false NOT NULL,
	`marca_oreja` integer DEFAULT false NOT NULL,
	`microchip` text,
	`estado` text DEFAULT 'en_colonia' NOT NULL,
	`observaciones` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`colony_id`) REFERENCES `colonies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `colony_cats_colony` ON `colony_cats` (`colony_id`);--> statement-breakpoint
CREATE TABLE `colony_censuses` (
	`id` text PRIMARY KEY NOT NULL,
	`colony_id` text NOT NULL,
	`user_id` text,
	`fecha` integer NOT NULL,
	`hembras_esterilizadas` integer DEFAULT 0 NOT NULL,
	`hembras_sin_esterilizar` integer DEFAULT 0 NOT NULL,
	`machos_castrados` integer DEFAULT 0 NOT NULL,
	`machos_sin_castrar` integer DEFAULT 0 NOT NULL,
	`adoptables` integer DEFAULT 0 NOT NULL,
	`enfermos` integer DEFAULT 0 NOT NULL,
	`observaciones` text,
	FOREIGN KEY (`colony_id`) REFERENCES `colonies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `colony_censuses_colony` ON `colony_censuses` (`colony_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `colony_members` (
	`id` text PRIMARY KEY NOT NULL,
	`colony_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol` text NOT NULL,
	`since` integer NOT NULL,
	`until` integer,
	`baja_motivo` text,
	`baja_jev` text,
	`baja_por` text,
	FOREIGN KEY (`colony_id`) REFERENCES `colonies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `colony_members_user` ON `colony_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `colony_members_colony` ON `colony_members` (`colony_id`);