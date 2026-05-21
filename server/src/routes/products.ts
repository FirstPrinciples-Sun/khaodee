import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AppEnv } from "../auth";
import { randomUUID } from "node:crypto";

const products = new Hono<AppEnv>();

const ProductInput = z.object({
  shopId: z.string(),
  name: z.string().min(1),
  categoryId: z.string().optional(),
  taxCode: z.enum(["VAT7", "VAT0", "EXEMPT"]).default("VAT7"),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().optional(),
        priceSatang: z.number().int().nonnegative(),
        costSatang: z.number().int().nonnegative().default(0),
        barcodes: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

products.use("*", requireAuth);

products.get("/", async (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const rows = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), isNull(schema.products.deletedAt)));
  return c.json({ products: rows });
});

products.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = ProductInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;

  const productId = randomUUID();
  db.insert(schema.products)
    .values({
      id: productId,
      shopId: data.shopId,
      categoryId: data.categoryId,
      name: data.name,
      taxCode: data.taxCode,
    })
    .run();

  for (const v of data.variants) {
    const variantId = randomUUID();
    db.insert(schema.variants)
      .values({
        id: variantId,
        productId,
        sku: v.sku,
        name: v.name,
        priceSatang: v.priceSatang,
        costSatang: v.costSatang,
      })
      .run();
    for (const code of v.barcodes) {
      db.insert(schema.barcodes).values({ code, variantId }).run();
    }
  }
  return c.json({ id: productId }, 201);
});

products.delete("/:id", async (c) => {
  const id = c.req.param("id");
  db.update(schema.products)
    .set({ deletedAt: new Date(Date.now()) })
    .where(eq(schema.products.id, id))
    .run();
  return c.body(null, 204);
});

export { products };
