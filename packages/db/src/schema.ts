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
  tin: text("tin"), // เลขประจำตัวผู้เสียภาษีอากร
  branch: text("branch").default("00000"),
  address: text("address"),
  phone: text("phone"),
  vatRegistered: integer("vat_registered", { mode: "boolean" }).notNull().default(false),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1), // month 1-12
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
  prefix: text("prefix").notNull(), // e.g. T1, T2 — used in receipt number
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
  taxCode: text("tax_code").notNull().default("VAT7"), // FK to tax_codes.code
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  shopActiveIdx: index("products_shop_active").on(t.shopId, t.isActive),
}));

export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  sku: text("sku").notNull(),
  name: text("name"), // e.g. "ใหญ่", "Red"
  priceSatang: integer("price_satang").notNull(), // selling price incl VAT (THB satang)
  costSatang: integer("cost_satang").notNull().default(0), // last-known cost, FIFO authoritative
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
  qty: real("qty").notNull().default(0), // allow fractional for weighted goods
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
  qty: real("qty").notNull(), // positive = in, negative = out
  unitCostSatang: integer("unit_cost_satang"), // for receive/refund layers
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
  subtotalSatang: integer("subtotal_satang").notNull(), // excl VAT
  vatSatang: integer("vat_satang").notNull(),
  totalSatang: integer("total_satang").notNull(), // incl VAT
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
  unitPriceSatang: integer("unit_price_satang").notNull(), // incl VAT
  unitCostSatang: integer("unit_cost_satang").notNull().default(0),
  taxCode: text("tax_code").notNull(),
  lineSubtotalSatang: integer("line_subtotal_satang").notNull(), // excl VAT
  lineVatSatang: integer("line_vat_satang").notNull(),
  lineTotalSatang: integer("line_total_satang").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id),
  method: text("method", { enum: ["cash", "promptpay", "card", "wallet", "credit"] }).notNull(),
  amountSatang: integer("amount_satang").notNull(),
  ref: text("ref"),
  slipHash: text("slip_hash"), // optional cross-link to slip-to-ledger verify
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

// ---------- Customers + loyalty ----------

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  phone: text("phone"),
  name: text("name"),
  tin: text("tin"), // for B2B full tax invoice
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  consentMarketing: integer("consent_marketing", { mode: "boolean" }).notNull().default(false),
  consentDate: integer("consent_date", { mode: "timestamp_ms" }),
});

// ---------- Tax invoices (sequential, server-authoritative) ----------

export const taxInvoices = sqliteTable("tax_invoices", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  fiscalYear: integer("fiscal_year").notNull(),
  terminalPrefix: text("terminal_prefix").notNull(),
  sequence: integer("sequence").notNull(),
  type: text("type", { enum: ["abbreviated", "full"] }).notNull(),
  number: text("number").notNull(), // formatted: T1-2026-000123
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
  code: text("code").primaryKey(), // VAT7, VAT0, EXEMPT
  name: text("name").notNull(),
  rate: real("rate").notNull(), // 0.07, 0.00
  outputAccountCode: text("output_account_code").notNull(), // 2151 VAT Output
  inputAccountCode: text("input_account_code").notNull(),  // 1156 VAT Input
});

export const chartOfAccounts = sqliteTable("chart_of_accounts", {
  code: text("code").primaryKey(), // e.g. 1010, 4010
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en").notNull(),
  type: text("type", {
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  }).notNull(),
  parentCode: text("parent_code"),
  isPreseeded: integer("is_preseeded", { mode: "boolean" }).notNull().default(false),
});

export const fiscalPeriods = sqliteTable("fiscal_periods", {
  id: text("id").primaryKey(), // e.g. shop1-2026-05
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
  sourceType: text("source_type").notNull(), // "sale", "refund", "shift_close", "adjust", "month_close"
  sourceId: text("source_id"),
  memo: text("memo"),
  createdBy: text("created_by").references(() => users.id),
}, (t) => ({
  shopPeriodIdx: index("je_shop_period").on(t.shopId, t.fiscalPeriodId),
}));

export const journalLines = sqliteTable("journal_lines", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull().references(() => journalEntries.id),
  accountCode: text("account_code").notNull().references(() => chartOfAccounts.code),
  debitSatang: integer("debit_satang").notNull().default(0),
  creditSatang: integer("credit_satang").notNull().default(0),
  taxCode: text("tax_code").references(() => taxCodes.code),
  memo: text("memo"),
}, (t) => ({
  entryIdx: index("jl_entry").on(t.entryId),
  accountIdx: index("jl_account").on(t.accountCode),
}));

// ---------- Audit log (hash-chained, append-only) ----------

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
