/** Shop + terminal bootstrap endpoints — needed before first sale. */

import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "../db";
import { requireAuth, type AppEnv } from "../auth";
import { eq } from "drizzle-orm";

const shops = new Hono<AppEnv>();
shops.use("*", requireAuth);

const ShopInput = z.object({
  id: z.string().min(1).optional(), // allow custom id like "demo-shop" for tests
  name: z.string().min(1),
  legalName: z.string().optional(),
  tin: z.string().regex(/^\d{13}$/).optional(),
  branch: z.string().default("00000"),
  address: z.string().optional(),
  phone: z.string().optional(),
  vatRegistered: z.boolean().default(true),
  fiscalYearStart: z.number().min(1).max(12).default(1),
});

shops.get("/", (c) => {
  const user = c.get("user");
  const rows = db
    .select({ shop: schema.shops, role: schema.userShops.role })
    .from(schema.userShops)
    .innerJoin(schema.shops, eq(schema.userShops.shopId, schema.shops.id))
    .where(eq(schema.userShops.userId, user.userId))
    .all();
  return c.json({ shops: rows });
});

shops.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = ShopInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const id = parsed.data.id ?? randomUUID();
  db.insert(schema.shops)
    .values({
      id,
      name: parsed.data.name,
      legalName: parsed.data.legalName,
      tin: parsed.data.tin,
      branch: parsed.data.branch,
      address: parsed.data.address,
      phone: parsed.data.phone,
      vatRegistered: parsed.data.vatRegistered,
      fiscalYearStart: parsed.data.fiscalYearStart,
    })
    .onConflictDoNothing()
    .run();
  db.insert(schema.userShops)
    .values({ userId: user.userId, shopId: id, role: "owner" })
    .onConflictDoNothing()
    .run();
  return c.json({ id }, 201);
});

const TerminalInput = z.object({
  id: z.string().min(1).optional(),
  shopId: z.string(),
  prefix: z.string().min(1).max(4),
  name: z.string().min(1),
});

shops.post("/terminals", async (c) => {
  const body = await c.req.json();
  const parsed = TerminalInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const id = parsed.data.id ?? randomUUID();
  db.insert(schema.terminals)
    .values({
      id,
      shopId: parsed.data.shopId,
      prefix: parsed.data.prefix,
      name: parsed.data.name,
    })
    .onConflictDoNothing()
    .run();
  return c.json({ id }, 201);
});

shops.get("/:shopId/terminals", (c) => {
  const shopId = c.req.param("shopId");
  const rows = db.select().from(schema.terminals).where(eq(schema.terminals.shopId, shopId)).all();
  return c.json({ terminals: rows });
});

export { shops };
