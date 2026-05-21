import { describe, it, expect } from "vitest";
import { postSale, postRefund, assertBalanced } from "./post-sale";

describe("postSale — double-entry invariant", () => {
  it("balances cash sale with VAT", () => {
    const e = postSale({
      transactionId: "tx-1",
      paymentMethod: "cash",
      totalSatang: 10700,
      vatSatang: 700,
    });
    const dr = e.lines.reduce((s, l) => s + l.debitSatang, 0);
    const cr = e.lines.reduce((s, l) => s + l.creditSatang, 0);
    expect(dr).toBe(cr);
    expect(dr).toBe(10700);
    expect(e.lines.find((l) => l.accountCode === "1010")?.debitSatang).toBe(10700);
    expect(e.lines.find((l) => l.accountCode === "4010")?.creditSatang).toBe(10000);
    expect(e.lines.find((l) => l.accountCode === "2151")?.creditSatang).toBe(700);
  });

  it("balances PromptPay sale", () => {
    const e = postSale({
      transactionId: "tx-2",
      paymentMethod: "promptpay",
      totalSatang: 5000,
      vatSatang: 0,
    });
    expect(e.lines.find((l) => l.accountCode === "1040")?.debitSatang).toBe(5000);
    expect(e.lines.find((l) => l.accountCode === "4010")?.creditSatang).toBe(5000);
  });

  it("rejects negative total", () => {
    expect(() =>
      postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: -1, vatSatang: 0 }),
    ).toThrow();
  });

  it("rejects VAT > total", () => {
    expect(() =>
      postSale({ transactionId: "x", paymentMethod: "cash", totalSatang: 100, vatSatang: 200 }),
    ).toThrow();
  });
});

describe("postRefund — mirrors sale", () => {
  it("reverses cash sale", () => {
    const refund = postRefund({
      transactionId: "tx-1",
      paymentMethod: "cash",
      totalSatang: 10700,
      vatSatang: 700,
    });
    expect(refund.sourceType).toBe("refund");
    expect(refund.lines.find((l) => l.accountCode === "1010")?.creditSatang).toBe(10700);
    expect(refund.lines.find((l) => l.accountCode === "4010")?.debitSatang).toBe(10000);
    expect(refund.lines.find((l) => l.accountCode === "2151")?.debitSatang).toBe(700);
  });
});

describe("assertBalanced", () => {
  it("throws on unbalanced entry", () => {
    expect(() =>
      assertBalanced({
        sourceType: "sale",
        sourceId: "x",
        lines: [
          { accountCode: "1010", debitSatang: 100, creditSatang: 0 },
          { accountCode: "4010", debitSatang: 0, creditSatang: 50 },
        ],
      }),
    ).toThrow();
  });
});
