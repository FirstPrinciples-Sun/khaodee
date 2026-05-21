/**
 * Khaodee SQLite schema (Drizzle).
 *
 * Boundaries:
 *   - All money is stored as INTEGER cents (THB satang). Avoid float drift.
 *   - Every journal_entry MUST satisfy sum(debit) = sum(credit).
 *     Enforced at write time by accounting.postSale, by DB CHECK on the
 *     entry_balance view, and by golden tests.
 *   - Audit log is hash-chained and append-only. Never UPDATE or DELETE.
 *   - Soft-delete via deleted_at, never hard delete (5-year tax retention).
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ---------- Tenancy / people ----------

export const shops = sqliteTable("shops", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  tin: text("tin"),
  branch: text("branch").default("00000"),
  address: text("address"),
  phone: text("phone"),
  vatRegistered: integer("vat_registered", { mode: "boolean" }).notNull().default(false),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_uniq").on(t.email),
}));

export const userShops = sqliteTable("user_shops", {
  userId: text("user_id").notNull().references(() => users.id),
  shopId: text("shop_id").notNull().references(() => shops.id),
  role: text("role", { enum: ["owner", "manager", "cashier", "accountant"] }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.shopId] }),
}));

export const terminals = sqliteTable("terminals", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  prefix: text("prefix").notNull(),
  name: text("name").notNull(),
}, (t) => ({
  shopPrefixIdx: uniqueIndex("terminals_shop_prefix_uniq").on(t.shopId, t.prefix),
}));

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  userId: text("user_id").notNull().references(() => users.id),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  openingCashSatang: integer("opening_cash_satang").notNull().default(0),
  closingCashSatang: integer("closing_cash_satang"),
  cashOverShortSatang: integer("cash_over_short_satang"),
});

// ---------- Catalog ----------

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  name: text("name").notNull(),
  parentId: text("parent_id"),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  categoryId: text("category_id").references(() => categories.id),
  name: text("name").notNull(),
  taxCode: text("tax_code").notNull().default("VAT7"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  shopActiveIdx: index("products_shop_active").on(t.shopId, t.isActive),
}));

export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  sku: text("sku").notNull(),
  name: text("name"),
  priceSatang: integer("price_satang").notNull(),
  costSatang: integer("cost_satang").notNull().default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  skuIdx: uniqueIndex("variants_sku_uniq").on(t.sku),
}));

export const barcodes = sqliteTable("barcodes", {
  code: text("code").primaryKey(),
  variantId: text("variant_id").notNull().references(() => variants.id),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  name: text("name").notNull(),
  tin: text("tin"),
  phone: text("phone"),
});

// ---------- Inventory (FIFO) ----------

export const stockLevels = sqliteTable("stock_levels", {
  shopId: text("shop_id").notNull().references(() => shops.id),
  variantId: text("variant_id").notNull().references(() => variants.id),
  qty: real("qty").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.shopId, t.variantId] }),
}));

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  variantId: text("variant_id").notNull().references(() => variants.id),
  type: text("type", {
    enum: ["receive", "sale", "refund", "adjust", "transfer_in", "transfer_out", "void"],
  }).notNull(),
  qty: real("qty").notNull(),
  unitCostSatang: integer("unit_cost_satang"),
  refType: text("ref_type"),
  refId: text("ref_id"),
  fifoLayerId: text("fifo_layer_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  variantTimeIdx: index("inv_variant_time").on(t.variantId, t.createdAt),
}));

// ---------- Sales ----------

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  shiftId: text("shift_id").references(() => shifts.id),
  status: text("status", {
    enum: ["draft", "committed", "voided", "refunded", "partial_refunded"],
  }).notNull().default("draft"),
  subtotalSatang: integer("subtotal_satang").notNull(),
  vatSatang: integer("vat_satang").notNull(),
  totalSatang: integer("total_satang").notNull(),
  invoiceId: text("invoice_id").references(() => taxInvoices.id),
  customerId: text("customer_id").references(() => customers.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  committedAt: integer("committed_at", { mode: "timestamp_ms" }),
}, (t) => ({
  shopStatusIdx: index("tx_shop_status").on(t.shopId, t.status),
}));

export const transactionLines = sqliteTable("transaction_lines", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id),
  variantId: text("variant_id").notNull().references(() => variants.id),
  qty: real("qty").notNull(),
  unitPriceSatang: integer("unit_price_satang").notNull(),
  unitCostSatang: integer("unit_cost_satang").notNull().default(0),
  taxCode: text("tax_code").notNull(),
  lineSubtotalSatang: integer("line_subtotal_satang").notNull(),
  lineVatSatang: integer("line_vat_satang").notNull(),
  lineTotalSatang: integer("line_total_satang").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id),
  method: text("method", { enum: ["cash", "promptpay", "card", "wallet", "credit"] }).notNull(),
  amountSatang: integer("amount_satang").notNull(),
  ref: text("ref"),
  slipHash: text("slip_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

// ---------- Customers + loyalty ----------

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  phone: text("phone"),
  name: text("name"),
  tin: text("tin"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  consentMarketing: integer("consent_marketing", { mode: "boolean" }).notNull().default(false),
  consentDate: integer("consent_date", { mode: "timestamp_ms" }),
});

// ---------- Tax invoices ----------

export const taxInvoices = sqliteTable("tax_invoices", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  fiscalYear: integer("fiscal_year").notNull(),
  terminalPrefix: text("terminal_prefix").notNull(),
  sequence: integer("sequence").notNull(),
  type: text("type", { enum: ["abbreviated", "full"] }).notNull(),
  number: text("number").notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => ({
  uniqSeq: uniqueIndex("tax_inv_uniq_seq").on(t.shopId, t.fiscalYear, t.terminalPrefix, t.sequence),
  uniqNumber: uniqueIndex("tax_inv_uniq_number").on(t.number),
}));

export const eTaxDocuments = sqliteTable("e_tax_documents", {
  invoiceId: text("invoice_id").primaryKey().references(() => taxInvoices.id),
  xml: text("xml"),
  signatureStatus: text("signature_status", {
    enum: ["pending", "signed", "submitted", "failed"],
  }).notNull().default("pending"),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
});

// ---------- Accounting ----------

export const taxCodes = sqliteTable("tax_codes", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  outputAccountCode: text("output_account_code").notNull(),
  inputAccountCode: text("input_account_code").notNull(),
});

export const chartOfAccounts = sqliteTable("chart_of_accounts", {
  code: text("code").primaryKey(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en").notNull(),
  type: text("type", {
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  }).notNull(),
  parentCode: text("parent_code"),
  isPreseeded: integer("is_preseeded", { mode: "boolean" }).notNull().default(false),
});

export const fiscalPeriods = sqliteTable("fiscal_periods", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
}, (t) => ({
  uniqYM: uniqueIndex("fp_shop_ym").on(t.shopId, t.year, t.month),
}));

export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  fiscalPeriodId: text("fiscal_period_id").notNull().references(() => fiscalPeriods.id),
  postedAt: integer("posted_at", { mode: "timestamp_ms" }).notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  memo: text("memo"),
  createdBy: text("created_by").references(() => users.id),
}, (t) => ({
  shopPeriodIdx: index("je_shop_period").on(t.shopId, t.fiscalPeriodId),
}));

export const journalLines = sqliteTable("journal_lines", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull().references(() => journalEntries.id),
  accountCode: text("account_code").notNull(),
  debitSatang: integer("debit_satang").notNull().default(0),
  creditSatang: integer("credit_satang").notNull().default(0),
  taxCode: text("tax_code"),
  memo: text("memo"),
}, (t) => ({
  entryIdx: index("jl_entry").on(t.entryId),
  accountIdx: index("jl_account").on(t.accountCode),
}));

// ---------- Audit log ----------

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  prevHash: text("prev_hash"),
  hash: text("hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  shopTimeIdx: index("audit_shop_time").on(t.shopId, t.createdAt),
}));

// ---------- HR / Payroll ----------

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  citizenId: text("citizen_id"),
  position: text("position"),
  baseSalarySatang: integer("base_salary_satang").notNull().default(0),
  bankAccount: text("bank_account"),
  phone: text("phone"),
  hiredAt: integer("hired_at", { mode: "timestamp_ms" }).notNull(),
  terminatedAt: integer("terminated_at", { mode: "timestamp_ms" }),
  ssoEnrolled: integer("sso_enrolled", { mode: "boolean" }).notNull().default(true),
  pinHash: text("pin_hash"),
  role: text("role", { enum: ["owner", "manager", "cashier", "accountant"] }).notNull().default("cashier"),
}, (t) => ({
  shopIdx: index("employees_shop").on(t.shopId),
}));

export const payrollRuns = sqliteTable("payroll_runs", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  status: text("status", { enum: ["draft", "posted", "paid"] }).notNull().default("draft"),
  postedAt: integer("posted_at", { mode: "timestamp_ms" }),
  journalEntryId: text("journal_entry_id").references(() => journalEntries.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  uniqRun: uniqueIndex("payroll_uniq").on(t.shopId, t.periodYear, t.periodMonth),
}));

export const payrollLines = sqliteTable("payroll_lines", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => payrollRuns.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  baseSalarySatang: integer("base_salary_satang").notNull().default(0),
  otHours: real("ot_hours").notNull().default(0),
  otRateSatang: integer("ot_rate_satang").notNull().default(0),
  bonusSatang: integer("bonus_satang").notNull().default(0),
  otherEarningsSatang: integer("other_earnings_satang").notNull().default(0),
  grossSatang: integer("gross_satang").notNull(),
  ssoEmployeeSatang: integer("sso_employee_satang").notNull().default(0),
  ssoEmployerSatang: integer("sso_employer_satang").notNull().default(0),
  whtSatang: integer("wht_satang").notNull().default(0),
  otherDeductSatang: integer("other_deduct_satang").notNull().default(0),
  netSatang: integer("net_satang").notNull(),
});

// ---------- Retail features ----------

export const discounts = sqliteTable("discounts", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["percent", "fixed"] }).notNull(),
  value: real("value").notNull(),
  minSubtotalSatang: integer("min_subtotal_satang").notNull().default(0),
  validFrom: integer("valid_from", { mode: "timestamp_ms" }),
  validTo: integer("valid_to", { mode: "timestamp_ms" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
}, (t) => ({
  shopCodeIdx: uniqueIndex("discount_code_uniq").on(t.shopId, t.code),
}));

export const giftCards = sqliteTable("gift_cards", {
  code: text("code").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  initialSatang: integer("initial_satang").notNull(),
  remainingSatang: integer("remaining_satang").notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["active", "expired", "depleted", "voided"] }).notNull().default("active"),
});

export const heldBills = sqliteTable("held_bills", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  customerId: text("customer_id").references(() => customers.id),
  label: text("label"),
  cartJson: text("cart_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  resumedAt: integer("resumed_at", { mode: "timestamp_ms" }),
});
