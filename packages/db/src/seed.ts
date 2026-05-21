/** Seed Thai chart of accounts + tax codes + a demo shop. */

import { THAI_COA, THAI_TAX_CODES } from "@khaodee/accounting";
import { openDb } from "./index";
import { chartOfAccounts, taxCodes } from "./schema";

export async function seedChartOfAccounts(db = openDb()) {
  for (const acc of THAI_COA) {
    db.insert(chartOfAccounts)
      .values({
        code: acc.code,
        nameTh: acc.nameTh,
        nameEn: acc.nameEn,
        type: acc.type,
        parentCode: acc.parentCode,
        isPreseeded: true,
      })
      .onConflictDoNothing()
      .run();
  }
  for (const tc of THAI_TAX_CODES) {
    db.insert(taxCodes)
      .values({
        code: tc.code,
        name: tc.name,
        rate: tc.rate,
        outputAccountCode: tc.outputAccountCode,
        inputAccountCode: tc.inputAccountCode,
      })
      .onConflictDoNothing()
      .run();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  await seedChartOfAccounts(db);
  console.log("seeded Thai COA + tax codes");
}
