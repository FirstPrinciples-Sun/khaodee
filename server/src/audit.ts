/**
 * Audit log — append-only with hash chain.
 *
 * Each row's hash = sha256(prevHash || actorId || action || entityType ||
 * entityId || beforeJson || afterJson || createdAt). Tampering is detected
 * by walking the chain in verifyAuditLog().
 */

import type { Db } from "@khaodee/db";
import { schema } from "@khaodee/db";
import { eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

export interface AuditEntry {
  shopId: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export function appendAudit(db: Db, e: AuditEntry): void {
  const last = db
    .select({ hash: schema.auditLog.hash })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.shopId, e.shopId))
    .orderBy(sql`${schema.auditLog.createdAt} DESC`)
    .limit(1)
    .all()[0];
  const prevHash = last?.hash ?? "";
  const beforeJson = e.before ? JSON.stringify(e.before) : null;
  const afterJson = e.after ? JSON.stringify(e.after) : null;
  const createdAt = Date.now();
  const id = randomUUID();
  const payload = [
    prevHash,
    e.actorId ?? "",
    e.action,
    e.entityType,
    e.entityId,
    beforeJson ?? "",
    afterJson ?? "",
    String(createdAt),
  ].join("|");
  const hash = createHash("sha256").update(payload).digest("hex");
  db.insert(schema.auditLog)
    .values({
      id,
      shopId: e.shopId,
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      beforeJson,
      afterJson,
      prevHash: prevHash || null,
      hash,
      createdAt: new Date(createdAt),
    })
    .run();
}

export interface AuditVerifyResult {
  ok: boolean;
  totalRows: number;
  brokenAt?: { id: string; createdAt: number };
}

export function verifyAuditLog(db: Db, shopId: string): AuditVerifyResult {
  const rows = db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.shopId, shopId))
    .orderBy(schema.auditLog.createdAt)
    .all();
  let prevHash = "";
  for (const r of rows) {
    if ((r.prevHash ?? "") !== prevHash) {
      return { ok: false, totalRows: rows.length, brokenAt: { id: r.id, createdAt: r.createdAt.getTime() } };
    }
    const expected = createHash("sha256")
      .update(
        [
          prevHash,
          r.actorId ?? "",
          r.action,
          r.entityType,
          r.entityId,
          r.beforeJson ?? "",
          r.afterJson ?? "",
          String(r.createdAt.getTime()),
        ].join("|"),
      )
      .digest("hex");
    if (expected !== r.hash) {
      return { ok: false, totalRows: rows.length, brokenAt: { id: r.id, createdAt: r.createdAt.getTime() } };
    }
    prevHash = r.hash;
  }
  return { ok: true, totalRows: rows.length };
}
