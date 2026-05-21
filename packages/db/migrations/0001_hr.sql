CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`citizen_id` text,
	`position` text,
	`base_salary_satang` integer DEFAULT 0 NOT NULL,
	`bank_account` text,
	`phone` text,
	`hired_at` integer NOT NULL,
	`terminated_at` integer,
	`sso_enrolled` integer DEFAULT true NOT NULL,
	`pin_hash` text,
	`role` text DEFAULT 'cashier' NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employees_shop` ON `employees` (`shop_id`);--> statement-breakpoint
CREATE TABLE `payroll_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`base_salary_satang` integer DEFAULT 0 NOT NULL,
	`ot_hours` real DEFAULT 0 NOT NULL,
	`ot_rate_satang` integer DEFAULT 0 NOT NULL,
	`bonus_satang` integer DEFAULT 0 NOT NULL,
	`other_earnings_satang` integer DEFAULT 0 NOT NULL,
	`gross_satang` integer NOT NULL,
	`sso_employee_satang` integer DEFAULT 0 NOT NULL,
	`sso_employer_satang` integer DEFAULT 0 NOT NULL,
	`wht_satang` integer DEFAULT 0 NOT NULL,
	`other_deduct_satang` integer DEFAULT 0 NOT NULL,
	`net_satang` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`posted_at` integer,
	`journal_entry_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_uniq` ON `payroll_runs` (`shop_id`,`period_year`,`period_month`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`account_code` text NOT NULL,
	`debit_satang` integer DEFAULT 0 NOT NULL,
	`credit_satang` integer DEFAULT 0 NOT NULL,
	`tax_code` text,
	`memo` text,
	FOREIGN KEY (`entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_journal_lines`("id", "entry_id", "account_code", "debit_satang", "credit_satang", "tax_code", "memo") SELECT "id", "entry_id", "account_code", "debit_satang", "credit_satang", "tax_code", "memo" FROM `journal_lines`;--> statement-breakpoint
DROP TABLE `journal_lines`;--> statement-breakpoint
ALTER TABLE `__new_journal_lines` RENAME TO `journal_lines`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `jl_entry` ON `journal_lines` (`entry_id`);--> statement-breakpoint
CREATE INDEX `jl_account` ON `journal_lines` (`account_code`);