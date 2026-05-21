/**
 * Transaction commit endpoint — server-authoritative.
 *
 * Sequence:
 *  1. validate cart (zod)
 *  2. compute VAT-inclusive totals (server side, never trust client)
 *  3. assign tax invoice number (IMMEDIATE tx, sequential per shop+year+terminal)
 *  4. insert transaction + lines + payments
 *  5. post double-entry journal (postSale)
 *  6. update stock_levels + write inventory_movements
 *  7. return the canonical tx (id, number, lines)
 */

import { Hono } from "hono";
import { z } from "zod";
import { db, schema } from "../db";
import { requireAuth, type AppEnv } from "../auth";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { postSale, assertBalanced } from "@khaodee/accounting";
import { issueTaxInvoice, fiscalYearForDate } from "../tax-invoice";

const tx = new Hono<AppEnv>();

const CartLine = z.object({
  variantId: z.string(),
  qty: z.number().positive(),
  unitPriceSatang: z.number().int().nonnegative(),
  taxCode: z.enum(["VAT7", "VAT0", "EXEMPT"]).default("VAT7"),
});

const CommitInput = z.object({
  shopId: z.string(),
  terminalId: z.string(),
  customerId: z.string().optional(),
  lines: z.array(CartLine).min(1),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "promptpay", "card", "wallet", "credit"]),
        amountSatang: z.number().int().nonnegative(),
        ref: z.string().optional(),
        slipHash: z.string().optional(),
      }),
    )
    .min(1),
  invoiceType: z.enum(["abbreviated", "full"]).default("abbreviated"),
});

tx.use("*", requireAuth);

tx.post("/commit", async (c) => {
  const body = await c.req.json();
  const parsed = CommitInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;

  const terminal = db
    .select()
    .from(schema.terminals)
    .where(eq(schema.terminals.id, data.terminalId))
    .all()[0];
  if (!terminal || terminal.shopId !== data.shopId) {
    return c.json({ error: "terminal not found in shop" }, 404);
  }

  // Compute totals server-side. Prices are VAT-inclusive.
  const VAT_RATE = 0.07;
  let totalSatang = 0;
  let vatSatang = 0;
  const enriched = data.lines.map((l) => {
    const lineTotal = Math.round(l.qty * l.unitPriceSatang);
    const lineSubtotal = l.taxCode === "VAT7" ? Math.round(lineTotal / (1 + VAT_RATE)) : lineTotal;
    const lineVat = lineTotal - lineSubtotal;
    totalSatang += lineTotal;
    vatSatang += lineVat;
    return { ...l, lineTotal, lineSubtotal, lineVat };
  });
  const subtotalSatang = totalSatang - vatSatang;

  const totalPaid = data.payments.reduce((s, p) => s + p.amountSatang, 0);
  if (totalPaid < totalSatang) {
    return c.json({ error: "insufficient payment", required: totalSatang, paid: totalPaid }, 400);
  }

  // Issue tax invoice number (IMMEDIATE, server-authoritative).
  const fiscalYear = fiscalYearForDate(new Date());
  const invoice = issueTaxInvoice(db, {
    shopId: data.shopId,
    terminalPrefix: terminal.prefix,
    fiscalYear,
    type: data.invoiceType,
  });

  const txId = randomUUID();
  const now = new Date();

  db.insert(schema.transactions)
    .values({
      id: txId,
      shopId: data.shopId,
      terminalId: data.terminalId,
      status: "committed",
      subtotalSatang,
      vatSatang,
      totalSatang,
      invoiceId: invoice.id,
      customerId: data.customerId,
      committedAt: now,
    })
    .run();

  for (const l of enriched) {
    db.insert(schema.transactionLines)
      .values({
        id: randomUUID(),
        transactionId: txId,
        variantId: l.variantId,
        qty: l.qty,
        unitPriceSatang: l.unitPriceSatang,
        taxCode: l.taxCode,
        lineSubtotalSatang: l.lineSubtotal,
        lineVatSatang: l.lineVat,
        lineTotalSatang: l.lineTotal,
      })
      .run();
    // Stock decrement (FIFO layer assignment is D12 work; provisional avg).
    db.insert(schema.inventoryMovements)
      .values({
        id: randomUUID(),
        shopId: data.shopId,
        variantId: l.variantId,
        type: "sale",
        qty: -l.qty,
        refType: "transaction",
        refId: txId,
      })
      .run();
    db.run(
      sql`INSERT INTO stock_levels (shop_id, variant_id, qty, updated_at)
          VALUES (${data.shopId}, ${l.variantId}, ${-l.qty}, ${Date.now()})
          ON CONFLICT(shop_id, variant_id) DO UPDATE SET
            qty = qty + ${-l.qty},
            updated_at = ${Date.now()}`,
    );
  }

  // Persist payments + post journal.
  let primaryMethod: "cash" | "promptpay" | "card" | "wallet" | "credit" = "cash";
  for (const p of data.payments) {
    db.insert(schema.payments)
      .values({
        id: randomUUID(),
        transactionId: txId,
        method: p.method,
        amountSatang: p.amountSatang,
        ref: p.ref,
        slipHash: p.slipHash,
      })
      .run();
    primaryMethod = p.method;
  }

  const entry = postSale({
    transactionId: txId,
    paymentMethod: primaryMethod,
    totalSatang,
    vatSatang,
  });
  assertBalanced(entry);
  await postJournalEntry(data.shopId, entry);

  return c.json({
    id: txId,
    invoiceNumber: invoice.number,
    totalSatang,
    vatSatang,
    subtotalSatang,
    committedAt: now.toISOString(),
  });
});

async function postJournalEntry(
  shopId: string,
  entry: ReturnType<typeof postSale>,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fpId = `${shopId}-${year}-${String(month).padStart(2, "0")}`;
  db.insert(schema.fiscalPeriods)
    .values({ id: fpId, shopId, year, month, status: "open" })
    .onConflictDoNothing()
    .run();

  const entryId = randomUUID();
  db.insert(schema.journalEntries)
    .values({
      id: entryId,
      shopId,
      fiscalPeriodId: fpId,
      postedAt: now,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
    })
    .run();
  for (const l of entry.lines) {
    db.insert(schema.journalLines)
      .values({
        id: randomUUID(),
        entryId,
        accountCode: l.accountCode,
        debitSatang: l.debitSatang,
        creditSatang: l.creditSatang,
        taxCode: l.taxCode,
        memo: l.memo,
      })
      .run();
  }
}

export { tx };
