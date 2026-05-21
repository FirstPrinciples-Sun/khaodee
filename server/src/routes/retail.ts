/**
 * Retail features: discounts, gift cards, held bills, customer search.
 */

import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "../db";
import { requireAuth, type AppEnv } from "../auth";
import { eq, and, sql, isNull, like, or } from "drizzle-orm";

const retail = new Hono<AppEnv>();
retail.use("*", requireAuth);

// ---------- Discounts ----------

const DiscountInput = z.object({
  shopId: z.string(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["percent", "fixed"]),
  value: z.number().nonnegative(),
  minSubtotalBaht: z.number().nonnegative().default(0),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

retail.get("/discounts", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const rows = db
    .select()
    .from(schema.discounts)
    .where(and(eq(schema.discounts.shopId, shopId), eq(schema.discounts.isActive, true)))
    .all();
  return c.json({ discounts: rows });
});

retail.post("/discounts", async (c) => {
  const body = await c.req.json();
  const parsed = DiscountInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;
  const id = randomUUID();
  db.insert(schema.discounts)
    .values({
      id,
      shopId: data.shopId,
      code: data.code.toUpperCase(),
      name: data.name,
      type: data.type,
      value: data.value,
      minSubtotalSatang: Math.round(data.minSubtotalBaht * 100),
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
    })
    .run();
  return c.json({ id }, 201);
});

retail.post("/discounts/apply", async (c) => {
  const body = await c.req.json();
  const { shopId, code, subtotalSatang } = body;
  const d = db
    .select()
    .from(schema.discounts)
    .where(and(eq(schema.discounts.shopId, shopId), eq(schema.discounts.code, String(code).toUpperCase())))
    .all()[0];
  if (!d || !d.isActive) return c.json({ error: "ไม่พบโค้ดส่วนลดนี้" }, 404);
  if (subtotalSatang < d.minSubtotalSatang) {
    return c.json({ error: `ขั้นต่ำ ${d.minSubtotalSatang / 100} บาท` }, 400);
  }
  const now = new Date();
  if (d.validFrom && now < d.validFrom) return c.json({ error: "ยังไม่ถึงวันใช้งาน" }, 400);
  if (d.validTo && now > d.validTo) return c.json({ error: "หมดอายุแล้ว" }, 400);

  const discountSatang =
    d.type === "percent"
      ? Math.round((subtotalSatang * d.value) / 100)
      : Math.round(d.value * 100);
  return c.json({ discountSatang, name: d.name });
});

// ---------- Gift cards ----------

retail.post("/giftcards", async (c) => {
  const body = await c.req.json();
  const Input = z.object({
    shopId: z.string(),
    code: z.string().optional(),
    initialBaht: z.number().positive(),
    expiresAt: z.string().optional(),
  });
  const parsed = Input.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const code = parsed.data.code ?? `GC-${Date.now().toString(36).toUpperCase()}`;
  const initSat = Math.round(parsed.data.initialBaht * 100);
  db.insert(schema.giftCards)
    .values({
      code,
      shopId: parsed.data.shopId,
      initialSatang: initSat,
      remainingSatang: initSat,
      issuedAt: new Date(),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    })
    .run();
  return c.json({ code, remainingSatang: initSat }, 201);
});

retail.get("/giftcards/:code", (c) => {
  const code = c.req.param("code");
  const gc = db.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).all()[0];
  if (!gc) return c.json({ error: "ไม่พบบัตรนี้" }, 404);
  return c.json(gc);
});

retail.post("/giftcards/:code/redeem", async (c) => {
  const code = c.req.param("code");
  const body = await c.req.json();
  const amountSatang = Number(body.amountSatang);
  if (!amountSatang || amountSatang <= 0) return c.json({ error: "amountSatang invalid" }, 400);
  const gc = db.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).all()[0];
  if (!gc || gc.status !== "active") return c.json({ error: "บัตรใช้ไม่ได้" }, 400);
  if (gc.remainingSatang < amountSatang) return c.json({ error: "ยอดในบัตรไม่พอ" }, 400);
  const newRemaining = gc.remainingSatang - amountSatang;
  db.update(schema.giftCards)
    .set({ remainingSatang: newRemaining, status: newRemaining === 0 ? "depleted" : "active" })
    .where(eq(schema.giftCards.code, code))
    .run();
  return c.json({ remainingSatang: newRemaining });
});

retail.get("/giftcards", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const rows = db.select().from(schema.giftCards).where(eq(schema.giftCards.shopId, shopId)).all();
  return c.json({ giftCards: rows });
});

// ---------- Held bills (พักบิล) ----------

retail.post("/held", async (c) => {
  const body = await c.req.json();
  const Input = z.object({
    shopId: z.string(),
    terminalId: z.string(),
    customerId: z.string().optional(),
    label: z.string().optional(),
    cart: z.any(),
  });
  const parsed = Input.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const id = randomUUID();
  db.insert(schema.heldBills)
    .values({
      id,
      shopId: parsed.data.shopId,
      terminalId: parsed.data.terminalId,
      customerId: parsed.data.customerId,
      label: parsed.data.label,
      cartJson: JSON.stringify(parsed.data.cart),
    })
    .run();
  return c.json({ id }, 201);
});

retail.get("/held", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const rows = db
    .select()
    .from(schema.heldBills)
    .where(and(eq(schema.heldBills.shopId, shopId), isNull(schema.heldBills.resumedAt)))
    .all();
  return c.json({
    held: rows.map((r) => ({ ...r, cart: JSON.parse(r.cartJson) })),
  });
});

retail.post("/held/:id/resume", (c) => {
  const id = c.req.param("id");
  db.update(schema.heldBills).set({ resumedAt: new Date() }).where(eq(schema.heldBills.id, id)).run();
  return c.json({ ok: true });
});

retail.delete("/held/:id", (c) => {
  const id = c.req.param("id");
  db.delete(schema.heldBills).where(eq(schema.heldBills.id, id)).run();
  return c.body(null, 204);
});

// ---------- Customers (search + loyalty) ----------

retail.get("/customers", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const q = c.req.query("q");
  let rows;
  if (q) {
    const pattern = `%${q}%`;
    rows = db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.shopId, shopId),
          or(like(schema.customers.name, pattern), like(schema.customers.phone, pattern)),
        ),
      )
      .limit(20)
      .all();
  } else {
    rows = db.select().from(schema.customers).where(eq(schema.customers.shopId, shopId)).limit(50).all();
  }
  return c.json({ customers: rows });
});

retail.post("/customers", async (c) => {
  const body = await c.req.json();
  const Input = z.object({
    shopId: z.string(),
    name: z.string().min(1),
    phone: z.string().optional(),
    tin: z.string().optional(),
    address: z.string().optional(),
    consentMarketing: z.boolean().default(false),
  });
  const parsed = Input.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const id = randomUUID();
  db.insert(schema.customers)
    .values({
      id,
      shopId: parsed.data.shopId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      tin: parsed.data.tin,
      address: parsed.data.address,
      consentMarketing: parsed.data.consentMarketing,
      consentDate: parsed.data.consentMarketing ? new Date() : null,
    })
    .run();
  return c.json({ id }, 201);
});

retail.post("/customers/:id/points", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const delta = Number(body.delta ?? 0);
  db.run(sql`UPDATE customers SET loyalty_points = loyalty_points + ${delta} WHERE id = ${id}`);
  return c.json({ ok: true });
});

export { retail };
