CREATE TABLE `discounts` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`min_subtotal_satang` integer DEFAULT 0 NOT NULL,
	`valid_from` integer,
	`valid_to` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_code_uniq` ON `discounts` (`shop_id`,`code`);--> statement-breakpoint
CREATE TABLE `gift_cards` (
	`code` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`initial_satang` integer NOT NULL,
	`remaining_satang` integer NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `held_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`customer_id` text,
	`label` text,
	`cart_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resumed_at` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
