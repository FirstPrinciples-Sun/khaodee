/**
 * Reports — Trial Balance, P&L, Balance Sheet, ภพ.30.
 *
 * All amounts in satang. Reads journal_lines + chart_of_accounts.
 * Pure functions: pass in a Drizzle Db instance.
 */

import type { Db } from "@khaodee/db";
import { schema } from "@khaodee/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface TrialBalanceRow {
  code: string;
  nameTh: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  debitSatang: number;
  creditSatang: number;
}

export function trialBalance(db: Db, shopId: string, asOf: Date = new Date()): TrialBalanceRow[] {
  const rows = db
    .select({
      code: schema.journalLines.accountCode,
      debit: sql<number>`SUM(${schema.journalLines.debitSatang})`,
      credit: sql<number>`SUM(${schema.journalLines.creditSatang})`,
    })
    .from(schema.journalLines)
    .leftJoin(schema.journalEntries, eq(schema.journalLines.entryId, schema.journalEntries.id))
    .where(and(eq(schema.journalEntries.shopId, shopId), lte(schema.journalEntries.postedAt, asOf)))
    .groupBy(schema.journalLines.accountCode)
    .all();

  const accounts = db.select().from(schema.chartOfAccounts).all();
  const accMap = new Map(accounts.map((a) => [a.code, a]));

  const result: TrialBalanceRow[] = [];
  for (const r of rows) {
    const acc = accMap.get(r.code);
    if (!acc) continue;
    const dr = Number(r.debit) || 0;
    const cr = Number(r.credit) || 0;
    const net = dr - cr;
    if (acc.type === "asset" || acc.type === "expense") {
      result.push({ code: r.code, nameTh: acc.nameTh, type: acc.type, debitSatang: Math.max(net, 0), creditSatang: Math.max(-net, 0) });
    } else {
      result.push({ code: r.code, nameTh: acc.nameTh, type: acc.type, debitSatang: Math.max(net, 0), creditSatang: Math.max(-net, 0) });
    }
  }
  result.sort((a, b) => a.code.localeCompare(b.code));
  return result;
}

export function profitAndLoss(db: Db, shopId: string, from: Date, to: Date) {
  const rows = db
    .select({
      code: schema.journalLines.accountCode,
      debit: sql<number>`SUM(${schema.journalLines.debitSatang})`,
      credit: sql<number>`SUM(${schema.journalLines.creditSatang})`,
    })
    .from(schema.journalLines)
    .leftJoin(schema.journalEntries, eq(schema.journalLines.entryId, schema.journalEntries.id))
    .where(
      and(
        eq(schema.journalEntries.shopId, shopId),
        gte(schema.journalEntries.postedAt, from),
        lte(schema.journalEntries.postedAt, to),
      ),
    )
    .groupBy(schema.journalLines.accountCode)
    .all();

  const accounts = db.select().from(schema.chartOfAccounts).all();
  const accMap = new Map(accounts.map((a) => [a.code, a]));

  let revenue = 0;
  let expense = 0;
  const breakdown: Array<{ code: string; nameTh: string; type: string; satang: number }> = [];
  for (const r of rows) {
    const acc = accMap.get(r.code);
    if (!acc) continue;
    const dr = Number(r.debit) || 0;
    const cr = Number(r.credit) || 0;
    if (acc.type === "revenue") {
      const amt = cr - dr;
      revenue += amt;
      breakdown.push({ code: r.code, nameTh: acc.nameTh, type: "revenue", satang: amt });
    } else if (acc.type === "expense") {
      const amt = dr - cr;
      expense += amt;
      breakdown.push({ code: r.code, nameTh: acc.nameTh, type: "expense", satang: amt });
    }
  }
  return { revenueSatang: revenue, expenseSatang: expense, netIncomeSatang: revenue - expense, breakdown };
}

export function balanceSheet(db: Db, shopId: string, asOf: Date = new Date()) {
  const tb = trialBalance(db, shopId, asOf);
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  const sections = { assets: [] as TrialBalanceRow[], liabilities: [] as TrialBalanceRow[], equity: [] as TrialBalanceRow[] };
  for (const r of tb) {
    if (r.type === "asset") {
      sections.assets.push(r);
      assets += r.debitSatang - r.creditSatang;
    } else if (r.type === "liability") {
      sections.liabilities.push(r);
      liabilities += r.creditSatang - r.debitSatang;
    } else if (r.type === "equity") {
      sections.equity.push(r);
      equity += r.creditSatang - r.debitSatang;
    }
  }
  return {
    assetsSatang: assets,
    liabilitiesSatang: liabilities,
    equitySatang: equity,
    balanced: assets === liabilities + equity,
    sections,
  };
}

/**
 * ภพ.30 monthly VAT report — emits CSV in Revenue Department column order.
 * Output: ยอดขาย, ภาษีขาย, ยอดซื้อ, ภาษีซื้อ, ภาษีต้องชำระ.
 */
export function pp30Csv(db: Db, shopId: string, year: number, month: number): string {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  const pl = profitAndLoss(db, shopId, from, to);

  const salesRow = pl.breakdown.find((r) => r.code === "4010");
  const vatOutputRows = db
    .select({ credit: sql<number>`SUM(${schema.journalLines.creditSatang})` })
    .from(schema.journalLines)
    .leftJoin(schema.journalEntries, eq(schema.journalLines.entryId, schema.journalEntries.id))
    .where(
      and(
        eq(schema.journalLines.accountCode, "2151"),
        eq(schema.journalEntries.shopId, shopId),
        gte(schema.journalEntries.postedAt, from),
        lte(schema.journalEntries.postedAt, to),
      ),
    )
    .all();

  const sales = (salesRow?.satang ?? 0) / 100;
  const vatOut = (Number(vatOutputRows[0]?.credit) || 0) / 100;

  const headers = ["เดือน", "ปี", "ยอดขาย (บาท)", "ภาษีขาย (บาท)", "ยอดซื้อ (บาท)", "ภาษีซื้อ (บาท)", "ภาษีต้องชำระ (บาท)"];
  const data = [String(month), String(year), sales.toFixed(2), vatOut.toFixed(2), "0.00", "0.00", vatOut.toFixed(2)];
  return headers.join(",") + "\n" + data.join(",") + "\n";
}
