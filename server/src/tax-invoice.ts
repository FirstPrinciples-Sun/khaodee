/**
 * Tax invoice numbering — server-authoritative, sequential per shop per
 * fiscal year per terminal prefix. Never CRDT-replicated.
 *
 * Format: <terminal_prefix>-<fiscal_year>-<6-digit-padded-sequence>
 * e.g. T1-2026-000123
 *
 * Issued in a single SQLite IMMEDIATE transaction so no two cashiers can
 * race the same number.
 */

import type { Db } from "@khaodee/db";
import { schema } from "@khaodee/db";
import { eq, and, max } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface IssueOptions {
  shopId: string;
  terminalPrefix: string;
  fiscalYear: number;
  type: "abbreviated" | "full";
}

export interface IssuedInvoice {
  id: string;
  number: string;
  sequence: number;
}

export function issueTaxInvoice(db: Db, opts: IssueOptions): IssuedInvoice {
  return db.transaction((tx) => {
    const lastSeqRow = tx
      .select({ max: max(schema.taxInvoices.sequence) })
      .from(schema.taxInvoices)
      .where(
        and(
          eq(schema.taxInvoices.shopId, opts.shopId),
          eq(schema.taxInvoices.fiscalYear, opts.fiscalYear),
          eq(schema.taxInvoices.terminalPrefix, opts.terminalPrefix),
        ),
      )
      .all();
    const next = (lastSeqRow[0]?.max ?? 0) + 1;
    const number = `${opts.terminalPrefix}-${opts.fiscalYear}-${String(next).padStart(6, "0")}`;
    const id = randomUUID();
    tx.insert(schema.taxInvoices)
      .values({
        id,
        shopId: opts.shopId,
        fiscalYear: opts.fiscalYear,
        terminalPrefix: opts.terminalPrefix,
        sequence: next,
        type: opts.type,
        number,
        issuedAt: new Date(),
      })
      .run();
    return { id, number, sequence: next };
  });
}

export function fiscalYearForDate(d: Date, fiscalStartMonth = 1): number {
  if (fiscalStartMonth === 1) return d.getFullYear();
  return d.getMonth() + 1 >= fiscalStartMonth ? d.getFullYear() : d.getFullYear() - 1;
}
