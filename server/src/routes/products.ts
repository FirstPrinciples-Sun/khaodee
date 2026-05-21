import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, and, isNull, inArray } from "drizzle-orm";
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
  const productRows = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), isNull(schema.products.deletedAt)));
  if (productRows.length === 0) return c.json({ products: [] });
  const productIds = productRows.map((p) => p.id);
  const variantRows = db
    .select()
    .from(schema.variants)
    .where(and(inArray(schema.variants.productId, productIds), isNull(schema.variants.deletedAt)))
    .all();
  const stockRows = db
    .select()
    .from(schema.stockLevels)
    .where(eq(schema.stockLevels.shopId, shopId))
    .all();
  const stockMap = new Map(stockRows.map((s) => [s.variantId, s.qty]));
  const variantsByProduct = new Map<string, any[]>();
  for (const v of variantRows) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    variantsByProduct.get(v.productId)!.push({ ...v, stockQty: stockMap.get(v.id) ?? 0 });
  }
  return c.json({
    products: productRows.map((p) => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] })),
  });
});

products.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = ProductInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;

  // Verify shop exists
  const shop = db.select().from(schema.shops).where(eq(schema.shops.id, data.shopId)).all()[0];
  if (!shop) return c.json({ error: `shop "${data.shopId}" does not exist — register a shop first` }, 404);

  // Check duplicate SKU before insert (cleaner error than UNIQUE constraint failure)
  for (const v of data.variants) {
    const dup = db.select().from(schema.variants).where(eq(schema.variants.sku, v.sku)).all()[0];
    if (dup) return c.json({ error: `SKU "${v.sku}" already exists` }, 409);
  }

  const productId = randomUUID();
  try {
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
  } catch (e: any) {
    return c.json({ error: e.message ?? "insert failed" }, 500);
  }
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
