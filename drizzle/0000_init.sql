CREATE TABLE `comparables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vin_or_listing_id` text NOT NULL,
	`source` text NOT NULL,
	`sold_price_usd` real NOT NULL,
	`sold_date` text NOT NULL,
	`vehicle_id` integer,
	`url` text NOT NULL,
	`raw_json` text NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `sources`(`source_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comparables_unique` ON `comparables` (`source`,`vin_or_listing_id`);--> statement-breakpoint
CREATE INDEX `comparables_vehicle_idx` ON `comparables` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `comparables_sold_date_idx` ON `comparables` (`sold_date`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`fixture_used` text,
	FOREIGN KEY (`source_key`) REFERENCES `sources`(`source_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_source_idx` ON `ingestion_runs` (`source_key`,`started_at`);--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`origin_port` text NOT NULL,
	`destination_port` text NOT NULL,
	`mode` text NOT NULL,
	`rate_usd` real NOT NULL,
	`currency` text NOT NULL,
	`rate_date` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `sources`(`source_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shipping_rates_lane_idx` ON `shipping_rates` (`origin_port`,`destination_port`,`rate_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_rates_unique` ON `shipping_rates` (`source`,`origin_port`,`destination_port`,`mode`,`rate_date`);--> statement-breakpoint
CREATE TABLE `sources` (
	`source_key` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`base_url` text NOT NULL,
	`rate_limit_per_sec` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tariffs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`destination_country` text NOT NULL,
	`hs_code` text NOT NULL,
	`ad_valorem_pct` real NOT NULL,
	`specific_usd` real NOT NULL,
	`trade_agreement` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`source` text NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `sources`(`source_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tariffs_lookup_idx` ON `tariffs` (`destination_country`,`hs_code`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `tariffs_unique` ON `tariffs` (`source`,`destination_country`,`hs_code`,`trade_agreement`,`effective_from`);--> statement-breakpoint
CREATE TABLE `trade_flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter` text NOT NULL,
	`partner` text NOT NULL,
	`hs_code` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`value_usd` real NOT NULL,
	`quantity` real NOT NULL,
	`flow_direction` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `sources`(`source_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trade_flows_lookup_idx` ON `trade_flows` (`reporter`,`partner`,`year`,`month`,`hs_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `trade_flows_unique` ON `trade_flows` (`source`,`reporter`,`partner`,`hs_code`,`year`,`month`,`flow_direction`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`body_class` text NOT NULL,
	`fuel_type` text NOT NULL,
	`hs_code` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vehicles_make_model_year_idx` ON `vehicles` (`make`,`model`,`year`);--> statement-breakpoint
CREATE INDEX `vehicles_hs_code_idx` ON `vehicles` (`hs_code`);