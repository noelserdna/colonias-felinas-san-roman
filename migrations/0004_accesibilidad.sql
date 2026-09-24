CREATE TABLE `accessibility_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`pagina` text,
	`descripcion` text NOT NULL,
	`nombre` text,
	`email` text,
	`estado` text DEFAULT 'nueva' NOT NULL,
	`respuesta` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
