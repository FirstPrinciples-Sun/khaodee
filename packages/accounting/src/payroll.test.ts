import { describe, it, expect } from "vitest";
import { calcPayroll, computeProgressivePit, postPayrollRun } from "./payroll";
import { assertBalanced } from "./post-sale";

describe("Thai payroll tax", () => {
  it("0% on income below 150k", () => {
    expect(computeProgressivePit(10_000_000)).toBe(0); // 100,000 baht
  });

  it("5% on 150k-300k slice", () => {
    // 200,000 taxable → 50,000 in 5% slice = 2,500 baht
    expect(computeProgressivePit(20_000_000)).toBe(250_000); // 2,500 baht in satang
  });

  it("computes monthly payroll for ฿20,000 base, no OT, no bonus", () => {
    const r = calcPayroll({ baseSalarySatang: 2_000_000 }); // 20,000 baht
    expect(r.grossSatang).toBe(2_000_000);
    expect(r.ssoEmployeeSatang).toBe(750_00); // capped at 750 baht (15k base × 5%)
    expect(r.ssoEmployerSatang).toBe(750_00);
    expect(r.whtSatang).toBe(0); // 20k × 12 = 240k → after deductions ≈ 71k → 0%
    expect(r.netSatang).toBe(2_000_000 - 750_00);
  });

  it("computes WHT for high salary (฿80,000)", () => {
    const r = calcPayroll({ baseSalarySatang: 8_000_000 });
    expect(r.grossSatang).toBe(8_000_000);
    expect(r.ssoEmployeeSatang).toBe(750_00); // still capped
    expect(r.whtSatang).toBeGreaterThan(0);
  });

  it("includes OT and bonus in gross", () => {
    const r = calcPayroll({
      baseSalarySatang: 1_500_000,
      otHours: 10,
      otRateSatang: 15_000, // 150 baht/hour
      bonusSatang: 500_000, // 5,000 baht
    });
    expect(r.otSatang).toBe(150_000); // 1,500 baht
    expect(r.grossSatang).toBe(1_500_000 + 150_000 + 500_000);
  });

  it("payroll journal entry is balanced", () => {
    const r1 = calcPayroll({ baseSalarySatang: 2_000_000 });
    const r2 = calcPayroll({ baseSalarySatang: 8_000_000, bonusSatang: 1_000_000 });
    const entry = postPayrollRun("test-run-1", [r1, r2]);
    assertBalanced(entry);
  });

  it("respects sso opt-out", () => {
    const r = calcPayroll({ baseSalarySatang: 2_000_000, ssoEnrolled: false });
    expect(r.ssoEmployeeSatang).toBe(0);
    expect(r.ssoEmployerSatang).toBe(0);
  });
});
