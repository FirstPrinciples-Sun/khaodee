/**
 * Double-entry posting for sales and refunds.
 *
 * Invariant (enforced): for every JournalEntry, sum(debit) === sum(credit).
 * Money is in satang (THB cents) — integers only, no float.
 */

export interface JournalLine {
  accountCode: string;
  debitSatang: number;
  creditSatang: number;
  taxCode?: string;
  memo?: string;
}

export interface JournalEntry {
  sourceType: "sale" | "refund" | "shift_close" | "adjust" | "month_close";
  sourceId: string;
  memo?: string;
  lines: JournalLine[];
}

export interface SaleInput {
  transactionId: string;
  paymentMethod: "cash" | "promptpay" | "card" | "wallet" | "credit";
  totalSatang: number;
  vatSatang: number;
  /** Cash payment account: 1010 cash, 1040 e-money for PromptPay, 1100 AR for credit. */
  paymentAccountCode?: string;
}

const SALES_REVENUE = "4010";
const VAT_OUTPUT = "2151";
const AR = "1100";

const PAYMENT_ACCOUNT: Record<SaleInput["paymentMethod"], string> = {
  cash: "1010",
  promptpay: "1040",
  card: "1040", // simplification — most acquirers settle to bank within T+1
  wallet: "1040",
  credit: AR,
};

export function postSale(input: SaleInput): JournalEntry {
  if (input.totalSatang < 0) {
    throw new Error("postSale: totalSatang must be non-negative");
  }
  if (input.vatSatang < 0 || input.vatSatang > input.totalSatang) {
    throw new Error("postSale: vatSatang out of range");
  }

  const paymentAccount = input.paymentAccountCode ?? PAYMENT_ACCOUNT[input.paymentMethod];
  const subtotalSatang = input.totalSatang - input.vatSatang;

  const lines: JournalLine[] = [
    { accountCode: paymentAccount, debitSatang: input.totalSatang, creditSatang: 0 },
    { accountCode: SALES_REVENUE, debitSatang: 0, creditSatang: subtotalSatang },
  ];
  if (input.vatSatang > 0) {
    lines.push({ accountCode: VAT_OUTPUT, debitSatang: 0, creditSatang: input.vatSatang, taxCode: "VAT7" });
  }

  return assertBalanced({
    sourceType: "sale",
    sourceId: input.transactionId,
    memo: `Sale ${input.transactionId}`,
    lines,
  });
}

export function postRefund(input: SaleInput): JournalEntry {
  // Refund = mirror of sale: reverse debits/credits.
  const sale = postSale(input);
  return assertBalanced({
    ...sale,
    sourceType: "refund",
    memo: `Refund of ${input.transactionId}`,
    lines: sale.lines.map((l) => ({
      ...l,
      debitSatang: l.creditSatang,
      creditSatang: l.debitSatang,
    })),
  });
}

export function assertBalanced(entry: JournalEntry): JournalEntry {
  const debits = entry.lines.reduce((s, l) => s + l.debitSatang, 0);
  const credits = entry.lines.reduce((s, l) => s + l.creditSatang, 0);
  if (debits !== credits) {
    throw new Error(
      `JournalEntry unbalanced: debits=${debits} credits=${credits} sourceId=${entry.sourceId}`,
    );
  }
  return entry;
}
