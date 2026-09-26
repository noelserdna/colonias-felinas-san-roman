ALTER TABLE `colony_cats` ADD `estado_desde` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `nacidos_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `nacidos_machos` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `nuevos_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `nuevos_machos` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `fallecidos_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `fallecidos_machos` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `adoptados_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `adoptados_machos` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `devueltos_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `devueltos_machos` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `otras_salidas_hembras` integer;--> statement-breakpoint
ALTER TABLE `colony_censuses` ADD `otras_salidas_machos` integer;--> statement-breakpoint
-- Las fichas existentes toman como fecha de su situación la de su última modificación.
UPDATE `colony_cats` SET `estado_desde` = `updated_at` WHERE `estado_desde` IS NULL;
