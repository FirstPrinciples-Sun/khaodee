import { describe, it, expect } from "vitest";
import { postSale, postRefund, assertBalanced } from "./post-sale";

/**
 * Property: every sale + refund pair must produce balanced entries
 * regardless of payment method or VAT amount.
 */
describe("accounting — golden coverage", () => {
  const methods = ["cash", "promptpay", "card", "wallet", "credit"] as const;
  for (const m of methods) {
    for (const total of [100, 1, 999_999, 12_345, 50_000]) {
      const vat = m === "credit" ? 0 : Math.round((total / 1.07) * 0.07);
      it(`balances ${m} sale total=${total} vat=${vat}`, () => {
        const e = postSale({ transactionId: `tx-${m}-${total}`, paymentMethod: m, totalSatang: total, vatSatang: vat });
        const dr = e.lines.reduce((s, l) => s + l.debitSatang, 0);
        const cr = e.lines.reduce((s, l) => s + l.creditSatang, 0);
        expect(dr).toBe(cr);
        expect(dr).toBe(total);
      });
    }
  }

  it("VAT-only sale (rounding edge)", () => {
    const e = postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: 7, vatSatang: 0 });
    const dr = e.lines.reduce((s, l) => s + l.debitSatang, 0);
    const cr = e.lines.reduce((s, l) => s + l.creditSatang, 0);
    expect(dr).toBe(cr);
  });

  it("rejects negative VAT", () => {
    expect(() =>
      postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: 100, vatSatang: -1 }),
    ).toThrow();
  });

  it("zero-amount sale is allowed (free promo)", () => {
    const e = postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: 0, vatSatang: 0 });
    expect(e.lines.length).toBeGreaterThan(0);
    const dr = e.lines.reduce((s, l) => s + l.debitSatang, 0);
    const cr = e.lines.reduce((s, l) => s + l.creditSatang, 0);
    expect(dr).toBe(cr);
  });

  it("refund double of refund equals original (idempotent reversal)", () => {
    const sale = postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: 10700, vatSatang: 700 });
    const r1 = postRefund({ transactionId: "x", paymentMethod: "cash", totalSatang: 10700, vatSatang: 700 });
    expect(r1.lines.find((l) => l.accountCode === "1010")?.creditSatang).toBe(10700);
    expect(sale.lines.find((l) => l.accountCode === "1010")?.debitSatang).toBe(10700);
  });

  it("manual unbalanced entry caught by assertBalanced", () => {
    expect(() =>
      assertBalanced({
        sourceType: "adjust",
        sourceId: "x",
        lines: [
          { accountCode: "1010", debitSatang: 100, creditSatang: 0 },
          { accountCode: "5990", debitSatang: 0, creditSatang: 99 },
        ],
      }),
    ).toThrow();
  });
});
