/**
 * Warehouse / inventory ops endpoints.
 *
 * - POST /receive    : รับสินค้าเข้า (Goods Receipt) → +stock, +FIFO layer, journal entry
 * - POST /count      : บันทึกการนับสต็อก → over/short adjustment journal
 * - POST /transfer   : โอนระหว่างสาขา → -stock A, +stock B (no journal — internal move)
 * - GET  /reorder    : รายการสินค้าที่ stock ต่ำกว่า minimum
 * - GET  /movements  : ดู inventory movements ทั้งหมด
 */

import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "../db";
import { requireAuth, type AppEnv } from "../auth";
import { eq, and, sql } from "drizzle-orm";

const inventory = new Hono<AppEnv>();
inventory.use("*", requireAuth);

const ReceiveInput = z.object({
  shopId: z.string(),
  supplierId: z.string().optional(),
  reference: z.string().optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string(),
        qty: z.number().positive(),
        unitCostSatang: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

inventory.post("/receive", async (c) => {
  const body = await c.req.json();
  const parsed = ReceiveInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;
  const refId = randomUUID();
  const now = Date.now();
  let totalCost = 0;

  for (const l of data.lines) {
    db.insert(schema.inventoryMovements)
      .values({
        id: randomUUID(),
        shopId: data.shopId,
        variantId: l.variantId,
        type: "receive",
        qty: l.qty,
        unitCostSatang: l.unitCostSatang,
        refType: "goods_receipt",
        refId,
      })
      .run();
    db.run(
      sql`INSERT INTO stock_levels (shop_id, variant_id, qty, updated_at)
          VALUES (${data.shopId}, ${l.variantId}, ${l.qty}, ${now})
          ON CONFLICT(shop_id, variant_id) DO UPDATE SET
            qty = qty + ${l.qty},
            updated_at = ${now}`,
    );
    db.update(schema.variants)
      .set({ costSatang: l.unitCostSatang })
      .where(eq(schema.variants.id, l.variantId))
      .run();
    totalCost += Math.round(l.qty * l.unitCostSatang);
  }

  // Journal entry: Dr Inventory, Cr Cash/AP (we'll assume cash receive for MVP)
  // 1310 Inventory Dr / 1010 Cash Cr
  if (totalCost > 0) {
    const fpId = `${data.shopId}-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    db.insert(schema.fiscalPeriods)
      .values({ id: fpId, shopId: data.shopId, year: new Date().getFullYear(), month: new Date().getMonth() + 1, status: "open" })
      .onConflictDoNothing()
      .run();
    const entryId = randomUUID();
    db.insert(schema.journalEntries)
      .values({
        id: entryId,
        shopId: data.shopId,
        fiscalPeriodId: fpId,
        postedAt: new Date(),
        sourceType: "adjust",
        sourceId: refId,
        memo: `รับสินค้าเข้า #${refId.slice(0, 8)}${data.reference ? ` (${data.reference})` : ""}`,
      })
      .run();
    db.insert(schema.journalLines)
      .values({ id: randomUUID(), entryId, accountCode: "1310", debitSatang: totalCost, creditSatang: 0 })
      .run();
    db.insert(schema.journalLines)
      .values({ id: randomUUID(), entryId, accountCode: "1010", debitSatang: 0, creditSatang: totalCost })
      .run();
  }

  return c.json({ id: refId, totalCostSatang: totalCost }, 201);
});

const CountInput = z.object({
  shopId: z.string(),
  lines: z
    .array(
      z.object({
        variantId: z.string(),
        countedQty: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});

inventory.post("/count", async (c) => {
  const body = await c.req.json();
  const parsed = CountInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;
  const refId = randomUUID();
  const adjustments: Array<{ variantId: string; expected: number; counted: number; delta: number }> = [];

  for (const l of data.lines) {
    const stock = db
      .select()
      .from(schema.stockLevels)
      .where(and(eq(schema.stockLevels.shopId, data.shopId), eq(schema.stockLevels.variantId, l.variantId)))
      .all()[0];
    const expected = stock?.qty ?? 0;
    const delta = l.countedQty - expected;
    if (delta !== 0) {
      db.insert(schema.inventoryMovements)
        .values({
          id: randomUUID(),
          shopId: data.shopId,
          variantId: l.variantId,
          type: "adjust",
          qty: delta,
          refType: "stock_count",
          refId,
        })
        .run();
      const now = Date.now();
      db.run(
        sql`INSERT INTO stock_levels (shop_id, variant_id, qty, updated_at)
            VALUES (${data.shopId}, ${l.variantId}, ${l.countedQty}, ${now})
            ON CONFLICT(shop_id, variant_id) DO UPDATE SET
              qty = ${l.countedQty},
              updated_at = ${now}`,
      );
    }
    adjustments.push({ variantId: l.variantId, expected, counted: l.countedQty, delta });
  }
  return c.json({ id: refId, adjustments });
});

const TransferInput = z.object({
  fromShopId: z.string(),
  toShopId: z.string(),
  lines: z.array(z.object({ variantId: z.string(), qty: z.number().positive() })).min(1),
});

inventory.post("/transfer", async (c) => {
  const body = await c.req.json();
  const parsed = TransferInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;
  const refId = randomUUID();
  const now = Date.now();

  for (const l of data.lines) {
    db.insert(schema.inventoryMovements)
      .values({
        id: randomUUID(),
        shopId: data.fromShopId,
        variantId: l.variantId,
        type: "transfer_out",
        qty: -l.qty,
        refType: "transfer",
        refId,
      })
      .run();
    db.insert(schema.inventoryMovements)
      .values({
        id: randomUUID(),
        shopId: data.toShopId,
        variantId: l.variantId,
        type: "transfer_in",
        qty: l.qty,
        refType: "transfer",
        refId,
      })
      .run();
    db.run(
      sql`INSERT INTO stock_levels (shop_id, variant_id, qty, updated_at)
          VALUES (${data.fromShopId}, ${l.variantId}, ${-l.qty}, ${now})
          ON CONFLICT(shop_id, variant_id) DO UPDATE SET
            qty = qty - ${l.qty},
            updated_at = ${now}`,
    );
    db.run(
      sql`INSERT INTO stock_levels (shop_id, variant_id, qty, updated_at)
          VALUES (${data.toShopId}, ${l.variantId}, ${l.qty}, ${now})
          ON CONFLICT(shop_id, variant_id) DO UPDATE SET
            qty = qty + ${l.qty},
            updated_at = ${now}`,
    );
  }
  return c.json({ id: refId }, 201);
});

inventory.get("/reorder", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const threshold = Number(c.req.query("threshold") ?? 5);
  const rows = db.all<any>(
    sql`SELECT v.id, v.sku, v.name AS variant_name, p.name AS product_name,
               COALESCE(s.qty, 0) AS qty, v.cost_satang AS cost_satang
        FROM variants v
        JOIN products p ON p.id = v.product_id
        LEFT JOIN stock_levels s ON s.variant_id = v.id AND s.shop_id = ${shopId}
        WHERE p.shop_id = ${shopId} AND p.deleted_at IS NULL AND v.deleted_at IS NULL
          AND COALESCE(s.qty, 0) <= ${threshold}
        ORDER BY qty ASC`,
  );
  return c.json({ items: rows ?? [], threshold });
});

inventory.get("/movements", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const rows = db
    .select()
    .from(schema.inventoryMovements)
    .where(eq(schema.inventoryMovements.shopId, shopId))
    .orderBy(sql`${schema.inventoryMovements.createdAt} DESC`)
    .limit(limit)
    .all();
  return c.json({ movements: rows });
});

export { inventory };
