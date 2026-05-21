/**
 * HR + Payroll endpoints.
 *
 * - GET  /employees?shopId
 * - POST /employees
 * - PATCH /employees/:id
 * - POST /payroll/run         body: { shopId, year, month, lines: [{employeeId, otHours?, otRateSatang?, bonusSatang?, otherEarningsSatang?, otherDeductSatang?}] }
 * - GET  /payroll?shopId      list runs
 * - GET  /payroll/:runId      with lines
 * - POST /payroll/:runId/post posts to ledger (creates balanced journal entry)
 */

import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "../db";
import { requireAuth, type AppEnv } from "../auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { calcPayroll, postPayrollRun, assertBalanced } from "@khaodee/accounting";

const hr = new Hono<AppEnv>();
hr.use("*", requireAuth);

const EmployeeInput = z.object({
  shopId: z.string(),
  name: z.string().min(1),
  citizenId: z.string().optional(),
  position: z.string().optional(),
  baseSalaryBaht: z.number().nonnegative(),
  bankAccount: z.string().optional(),
  phone: z.string().optional(),
  ssoEnrolled: z.boolean().default(true),
  role: z.enum(["owner", "manager", "cashier", "accountant"]).default("cashier"),
});

hr.get("/employees", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const rows = db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.shopId, shopId), isNull(schema.employees.terminatedAt)))
    .all();
  return c.json({ employees: rows });
});

hr.post("/employees", async (c) => {
  const body = await c.req.json();
  const parsed = EmployeeInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;
  const id = randomUUID();
  db.insert(schema.employees)
    .values({
      id,
      shopId: data.shopId,
      name: data.name,
      citizenId: data.citizenId,
      position: data.position,
      baseSalarySatang: Math.round(data.baseSalaryBaht * 100),
      bankAccount: data.bankAccount,
      phone: data.phone,
      ssoEnrolled: data.ssoEnrolled,
      role: data.role,
      hiredAt: new Date(),
    })
    .run();
  return c.json({ id }, 201);
});

const PayrollRunInput = z.object({
  shopId: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  lines: z.array(
    z.object({
      employeeId: z.string(),
      otHours: z.number().nonnegative().default(0),
      otRateBaht: z.number().nonnegative().default(0),
      bonusBaht: z.number().nonnegative().default(0),
      otherEarningsBaht: z.number().nonnegative().default(0),
      otherDeductBaht: z.number().nonnegative().default(0),
    }),
  ),
});

hr.post("/payroll/run", async (c) => {
  const body = await c.req.json();
  const parsed = PayrollRunInput.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const data = parsed.data;

  const runId = randomUUID();
  db.insert(schema.payrollRuns)
    .values({ id: runId, shopId: data.shopId, periodYear: data.year, periodMonth: data.month, status: "draft" })
    .run();

  const employees = db.select().from(schema.employees).where(eq(schema.employees.shopId, data.shopId)).all();
  const empMap = new Map(employees.map((e) => [e.id, e]));

  for (const l of data.lines) {
    const emp = empMap.get(l.employeeId);
    if (!emp) continue;
    const result = calcPayroll({
      baseSalarySatang: emp.baseSalarySatang,
      otHours: l.otHours,
      otRateSatang: Math.round(l.otRateBaht * 100),
      bonusSatang: Math.round(l.bonusBaht * 100),
      otherEarningsSatang: Math.round(l.otherEarningsBaht * 100),
      otherDeductSatang: Math.round(l.otherDeductBaht * 100),
      ssoEnrolled: emp.ssoEnrolled,
    });
    db.insert(schema.payrollLines)
      .values({
        id: randomUUID(),
        runId,
        employeeId: l.employeeId,
        baseSalarySatang: result.baseSalarySatang,
        otHours: l.otHours,
        otRateSatang: Math.round(l.otRateBaht * 100),
        bonusSatang: result.bonusSatang,
        otherEarningsSatang: result.otherEarningsSatang,
        grossSatang: result.grossSatang,
        ssoEmployeeSatang: result.ssoEmployeeSatang,
        ssoEmployerSatang: result.ssoEmployerSatang,
        whtSatang: result.whtSatang,
        otherDeductSatang: result.otherDeductSatang,
        netSatang: result.netSatang,
      })
      .run();
  }
  return c.json({ id: runId }, 201);
});

hr.get("/payroll", (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId) return c.json({ error: "shopId required" }, 400);
  const runs = db
    .select()
    .from(schema.payrollRuns)
    .where(eq(schema.payrollRuns.shopId, shopId))
    .orderBy(desc(schema.payrollRuns.periodYear), desc(schema.payrollRuns.periodMonth))
    .all();
  return c.json({ runs });
});

hr.get("/payroll/:runId", (c) => {
  const runId = c.req.param("runId");
  const run = db.select().from(schema.payrollRuns).where(eq(schema.payrollRuns.id, runId)).all()[0];
  if (!run) return c.json({ error: "not found" }, 404);
  const lines = db.select().from(schema.payrollLines).where(eq(schema.payrollLines.runId, runId)).all();
  const employees = db.select().from(schema.employees).where(eq(schema.employees.shopId, run.shopId)).all();
  const empMap = new Map(employees.map((e) => [e.id, e]));
  return c.json({
    run,
    lines: lines.map((l) => ({ ...l, employeeName: empMap.get(l.employeeId)?.name ?? "?" })),
  });
});

hr.post("/payroll/:runId/post", async (c) => {
  const runId = c.req.param("runId");
  const run = db.select().from(schema.payrollRuns).where(eq(schema.payrollRuns.id, runId)).all()[0];
  if (!run) return c.json({ error: "not found" }, 404);
  if (run.status === "posted" || run.status === "paid") {
    return c.json({ error: `already ${run.status}` }, 409);
  }

  const lines = db.select().from(schema.payrollLines).where(eq(schema.payrollLines.runId, runId)).all();
  const results = lines.map((l) => ({
    baseSalarySatang: l.baseSalarySatang,
    otSatang: Math.round(l.otHours * l.otRateSatang),
    bonusSatang: l.bonusSatang,
    otherEarningsSatang: l.otherEarningsSatang,
    grossSatang: l.grossSatang,
    ssoEmployeeSatang: l.ssoEmployeeSatang,
    ssoEmployerSatang: l.ssoEmployerSatang,
    whtSatang: l.whtSatang,
    otherDeductSatang: l.otherDeductSatang,
    netSatang: l.netSatang,
  }));

  const entry = postPayrollRun(runId, results);
  assertBalanced(entry);

  // Open fiscal period if needed
  const fpId = `${run.shopId}-${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
  db.insert(schema.fiscalPeriods)
    .values({ id: fpId, shopId: run.shopId, year: run.periodYear, month: run.periodMonth, status: "open" })
    .onConflictDoNothing()
    .run();

  const entryId = randomUUID();
  db.insert(schema.journalEntries)
    .values({
      id: entryId,
      shopId: run.shopId,
      fiscalPeriodId: fpId,
      postedAt: new Date(),
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
    })
    .run();
  for (const line of entry.lines) {
    db.insert(schema.journalLines)
      .values({
        id: randomUUID(),
        entryId,
        accountCode: line.accountCode,
        debitSatang: line.debitSatang,
        creditSatang: line.creditSatang,
        memo: line.memo,
      })
      .run();
  }
  db.update(schema.payrollRuns)
    .set({ status: "posted", postedAt: new Date(), journalEntryId: entryId })
    .where(eq(schema.payrollRuns.id, runId))
    .run();

  return c.json({ ok: true, journalEntryId: entryId });
});

export { hr };
