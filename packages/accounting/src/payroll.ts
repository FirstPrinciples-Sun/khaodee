/**
 * Thai payroll tax calculation.
 *
 * Sources:
 * - Revenue Department PIT brackets 2024-onward (อัตราภาษีเงินได้บุคคลธรรมดา)
 * - Social Security Office: 5% of base salary, capped at salary 15,000/month
 *   (so max contribution = 750/month each side, employer + employee)
 *
 * For monthly WHT estimation, we annualize: tax = annualPit(monthly * 12) / 12.
 * Standard deductions used (simplified, MVP):
 *   - 50% expense deduction capped at 100,000 (มาตรา 42 ทวิ)
 *   - 60,000 personal allowance (มาตรา 47)
 * User can extend later with spouse/child/insurance/etc.
 */

export interface PayrollInput {
  baseSalarySatang: number;
  otHours?: number;
  otRateSatang?: number;
  bonusSatang?: number;
  otherEarningsSatang?: number;
  ssoEnrolled?: boolean;
  otherDeductSatang?: number;
}

export interface PayrollResult {
  baseSalarySatang: number;
  otSatang: number;
  bonusSatang: number;
  otherEarningsSatang: number;
  grossSatang: number;
  ssoEmployeeSatang: number;
  ssoEmployerSatang: number;
  whtSatang: number;
  otherDeductSatang: number;
  netSatang: number;
}

export function calcPayroll(input: PayrollInput): PayrollResult {
  const base = input.baseSalarySatang;
  const otSatang = Math.round((input.otHours ?? 0) * (input.otRateSatang ?? 0));
  const bonus = input.bonusSatang ?? 0;
  const other = input.otherEarningsSatang ?? 0;
  const gross = base + otSatang + bonus + other;

  // SSO 5% of base, capped 750/month each side (= 15000 base)
  const ssoEmployee = input.ssoEnrolled === false ? 0 : Math.min(Math.round(base * 0.05), 750_00);
  const ssoEmployer = ssoEmployee;

  // WHT: annualize gross, compute PIT, divide back to monthly.
  const annualGross = gross * 12;
  const annualSso = ssoEmployee * 12;
  const annualPit = computeAnnualPit(annualGross, annualSso);
  const wht = Math.round(annualPit / 12);

  const otherDeduct = input.otherDeductSatang ?? 0;
  const net = gross - ssoEmployee - wht - otherDeduct;

  return {
    baseSalarySatang: base,
    otSatang,
    bonusSatang: bonus,
    otherEarningsSatang: other,
    grossSatang: gross,
    ssoEmployeeSatang: ssoEmployee,
    ssoEmployerSatang: ssoEmployer,
    whtSatang: wht,
    otherDeductSatang: otherDeduct,
    netSatang: net,
  };
}

/** Compute annual personal income tax in satang. */
export function computeAnnualPit(annualGrossSatang: number, annualSsoSatang: number): number {
  // 50% expense capped at 100,000 baht (10,000,000 satang)
  const expense = Math.min(Math.round(annualGrossSatang * 0.5), 10_000_000);
  // Personal allowance 60,000 baht
  const personalAllowance = 6_000_000;
  // SSO is also a deduction
  const taxable = Math.max(annualGrossSatang - expense - personalAllowance - annualSsoSatang, 0);

  return computeProgressivePit(taxable);
}

/** PIT brackets in baht, applied to taxable income (in satang). */
const BRACKETS: Array<{ upToSatang: number; rate: number }> = [
  { upToSatang:  15_000_000, rate: 0.00 }, // 0–150,000
  { upToSatang:  30_000_000, rate: 0.05 }, // 150,001–300,000
  { upToSatang:  50_000_000, rate: 0.10 }, // 300,001–500,000
  { upToSatang:  75_000_000, rate: 0.15 }, // 500,001–750,000
  { upToSatang: 100_000_000, rate: 0.20 }, // 750,001–1,000,000
  { upToSatang: 200_000_000, rate: 0.25 }, // 1,000,001–2,000,000
  { upToSatang: 500_000_000, rate: 0.30 }, // 2,000,001–5,000,000
  { upToSatang: Infinity,    rate: 0.35 }, // > 5,000,000
];

export function computeProgressivePit(taxableSatang: number): number {
  let remaining = taxableSatang;
  let prev = 0;
  let tax = 0;
  for (const b of BRACKETS) {
    const slice = Math.min(remaining, b.upToSatang - prev);
    if (slice > 0) tax += Math.round(slice * b.rate);
    remaining -= slice;
    prev = b.upToSatang;
    if (remaining <= 0) break;
  }
  return tax;
}

/**
 * Build the journal entry for posting a payroll run.
 *
 * Per employee:
 *   Dr 5300 Salary (base + OT + bonus + other)
 *   Dr 5330 Employer SSO contribution
 *     Cr 1010 Cash (net pay)
 *     Cr 2152 WHT payable
 *     Cr 2153 SSO payable (employee + employer)
 *
 * Returns balanced journal entry (sum debits == sum credits).
 */
import type { JournalEntry } from "./post-sale";

export function postPayrollRun(runId: string, results: PayrollResult[]): JournalEntry {
  let totalGross = 0;
  let totalEmployerSso = 0;
  let totalNet = 0;
  let totalWht = 0;
  let totalSso = 0; // employee + employer

  for (const r of results) {
    totalGross += r.grossSatang;
    totalEmployerSso += r.ssoEmployerSatang;
    totalNet += r.netSatang - r.otherDeductSatang;
    totalWht += r.whtSatang;
    totalSso += r.ssoEmployeeSatang + r.ssoEmployerSatang;
  }

  const lines = [
    { accountCode: "5300", debitSatang: totalGross, creditSatang: 0, memo: "Salary, OT, bonus, other" },
    { accountCode: "5330", debitSatang: totalEmployerSso, creditSatang: 0, memo: "Employer SSO contribution" },
    { accountCode: "1010", debitSatang: 0, creditSatang: totalNet, memo: "Net pay (cash out)" },
    { accountCode: "2152", debitSatang: 0, creditSatang: totalWht, memo: "Withholding tax payable" },
    { accountCode: "2153", debitSatang: 0, creditSatang: totalSso, memo: "Social security payable" },
  ].filter((l) => l.debitSatang > 0 || l.creditSatang > 0);

  return {
    sourceType: "adjust",
    sourceId: runId,
    memo: `Payroll run ${runId}`,
    lines,
  };
}
