import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AppEnv } from "../auth";
import { trialBalance, profitAndLoss, balanceSheet, pp30Csv } from "@khaodee/reports";

const reports = new Hono<AppEnv>();
reports.use("*", requireAuth);

reports.get("/trial-balance", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const asOf = c.req.query("asOf") ? new Date(c.req.query("asOf")!) : new Date();
  return c.json({ rows: trialBalance(db, shopId, asOf), asOf: asOf.toISOString() });
});

reports.get("/pnl", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const fromStr = c.req.query("from");
  const toStr = c.req.query("to");
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400_000);
  const to = toStr ? new Date(toStr) : new Date();
  return c.json({ ...profitAndLoss(db, shopId, from, to), from: from.toISOString(), to: to.toISOString() });
});

reports.get("/balance-sheet", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const asOf = c.req.query("asOf") ? new Date(c.req.query("asOf")!) : new Date();
  return c.json({ ...balanceSheet(db, shopId, asOf), asOf: asOf.toISOString() });
});

reports.get("/pp30.csv", (c) => {
  const shopId = c.req.query("shopId");
  const year = Number(c.req.query("year"));
  const month = Number(c.req.query("month"));
  if (!shopId || !year || !month) return c.json({ error: "shopId, year, month required" }, 400);
  const csv = pp30Csv(db, shopId, year, month);
  return new Response("﻿" + csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pp30-${year}-${month}.csv"` },
  });
});

reports.get("/journal", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const entries = db
    .select()
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.shopId, shopId))
    .orderBy(sql`${schema.journalEntries.postedAt} DESC`)
    .limit(limit)
    .all();
  const lines = db.select().from(schema.journalLines).all();
  const linesByEntry = new Map<string, typeof lines>();
  for (const l of lines) {
    if (!linesByEntry.has(l.entryId)) linesByEntry.set(l.entryId, []);
    linesByEntry.get(l.entryId)!.push(l);
  }
  return c.json({
    entries: entries.map((e) => ({
      ...e,
      lines: linesByEntry.get(e.id) ?? [],
    })),
  });
});

reports.get("/coa", (c) => {
  const accounts = db.select().from(schema.chartOfAccounts).orderBy(schema.chartOfAccounts.code).all();
  return c.json({ accounts });
});

export { reports };
