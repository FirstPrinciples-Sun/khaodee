CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`prev_hash` text,
	`hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_shop_time` ON `audit_log` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `barcodes` (
	`code` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chart_of_accounts` (
	`code` text PRIMARY KEY NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`type` text NOT NULL,
	`parent_code` text,
	`is_preseeded` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`phone` text,
	`name` text,
	`tin` text,
	`address` text,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`consent_marketing` integer DEFAULT false NOT NULL,
	`consent_date` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `e_tax_documents` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`xml` text,
	`signature_status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`invoice_id`) REFERENCES `tax_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fiscal_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fp_shop_ym` ON `fiscal_periods` (`shop_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`type` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_satang` integer,
	`ref_type` text,
	`ref_id` text,
	`fifo_layer_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_variant_time` ON `inventory_movements` (`variant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`fiscal_period_id` text NOT NULL,
	`posted_at` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`memo` text,
	`created_by` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `je_shop_period` ON `journal_entries` (`shop_id`,`fiscal_period_id`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`account_code` text NOT NULL,
	`debit_satang` integer DEFAULT 0 NOT NULL,
	`credit_satang` integer DEFAULT 0 NOT NULL,
	`tax_code` text,
	`memo` text,
	FOREIGN KEY (`entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_code`) REFERENCES `chart_of_accounts`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tax_code`) REFERENCES `tax_codes`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jl_entry` ON `journal_lines` (`entry_id`);--> statement-breakpoint
CREATE INDEX `jl_account` ON `journal_lines` (`account_code`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`method` text NOT NULL,
	`amount_satang` integer NOT NULL,
	`ref` text,
	`slip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`tax_code` text DEFAULT 'VAT7' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `products_shop_active` ON `products` (`shop_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`opening_cash_satang` integer DEFAULT 0 NOT NULL,
	`closing_cash_satang` integer,
	`cash_over_short_satang` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`tin` text,
	`branch` text DEFAULT '00000',
	`address` text,
	`phone` text,
	`vat_registered` integer DEFAULT false NOT NULL,
	`fiscal_year_start` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_levels` (
	`shop_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`shop_id`, `variant_id`),
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`name` text NOT NULL,
	`tin` text,
	`phone` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tax_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rate` real NOT NULL,
	`output_account_code` text NOT NULL,
	`input_account_code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`terminal_prefix` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`number` text NOT NULL,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_inv_uniq_seq` ON `tax_invoices` (`shop_id`,`fiscal_year`,`terminal_prefix`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `tax_inv_uniq_number` ON `tax_invoices` (`number`);--> statement-breakpoint
CREATE TABLE `terminals` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`prefix` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terminals_shop_prefix_uniq` ON `terminals` (`shop_id`,`prefix`);--> statement-breakpoint
CREATE TABLE `transaction_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price_satang` integer NOT NULL,
	`unit_cost_satang` integer DEFAULT 0 NOT NULL,
	`tax_code` text NOT NULL,
	`line_subtotal_satang` integer NOT NULL,
	`line_vat_satang` integer NOT NULL,
	`line_total_satang` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`shift_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal_satang` integer NOT NULL,
	`vat_satang` integer NOT NULL,
	`total_satang` integer NOT NULL,
	`invoice_id` text,
	`customer_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`committed_at` integer,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `tax_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tx_shop_status` ON `transactions` (`shop_id`,`status`);--> statement-breakpoint
CREATE TABLE `user_shops` (
	`user_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`user_id`, `shop_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uniq` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text,
	`price_satang` integer NOT NULL,
	`cost_satang` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_uniq` ON `variants` (`sku`);