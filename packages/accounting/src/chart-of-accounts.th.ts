/**
 * Thai Standard Chart of Accounts (TFRS for SMEs).
 *
 * Code structure:
 *   1xxx — Assets (สินทรัพย์)
 *   2xxx — Liabilities (หนี้สิน)
 *   3xxx — Equity (ส่วนของเจ้าของ)
 *   4xxx — Revenue (รายได้)
 *   5xxx — Expense (ค่าใช้จ่าย / ต้นทุน)
 *
 * Subset preseeded — covers what a small Thai retail shop needs day-1.
 * User can add sub-accounts but cannot delete preseeded codes.
 *
 * NOTE: A Thai accountant should review before any production deployment.
 * Codes follow common practice across major Thai accounting software.
 */

export interface CoaEntry {
  code: string;
  nameTh: string;
  nameEn: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parentCode?: string;
}

export const THAI_COA: CoaEntry[] = [
  // 1xxx Assets
  { code: "1000", nameTh: "สินทรัพย์", nameEn: "Assets", type: "asset" },
  { code: "1010", nameTh: "เงินสดในมือ", nameEn: "Cash on hand", type: "asset", parentCode: "1000" },
  { code: "1020", nameTh: "เงินฝากธนาคาร – กระแสรายวัน", nameEn: "Bank — current", type: "asset", parentCode: "1000" },
  { code: "1030", nameTh: "เงินฝากธนาคาร – ออมทรัพย์", nameEn: "Bank — savings", type: "asset", parentCode: "1000" },
  { code: "1040", nameTh: "เงินอิเล็กทรอนิกส์ (E-money / PromptPay)", nameEn: "E-money / PromptPay", type: "asset", parentCode: "1000" },
  { code: "1100", nameTh: "ลูกหนี้การค้า", nameEn: "Accounts receivable", type: "asset", parentCode: "1000" },
  { code: "1156", nameTh: "ภาษีซื้อ (VAT Input)", nameEn: "VAT input — receivable", type: "asset", parentCode: "1000" },
  { code: "1310", nameTh: "สินค้าคงเหลือ", nameEn: "Inventory", type: "asset", parentCode: "1000" },

  // 2xxx Liabilities
  { code: "2000", nameTh: "หนี้สิน", nameEn: "Liabilities", type: "liability" },
  { code: "2110", nameTh: "เจ้าหนี้การค้า", nameEn: "Accounts payable", type: "liability", parentCode: "2000" },
  { code: "2151", nameTh: "ภาษีขาย (VAT Output)", nameEn: "VAT output — payable", type: "liability", parentCode: "2000" },
  { code: "2152", nameTh: "ภาษีหัก ณ ที่จ่ายค้างจ่าย", nameEn: "Withholding tax payable", type: "liability", parentCode: "2000" },

  // 3xxx Equity
  { code: "3000", nameTh: "ส่วนของเจ้าของ", nameEn: "Equity", type: "equity" },
  { code: "3100", nameTh: "ทุนจดทะเบียน", nameEn: "Registered capital", type: "equity", parentCode: "3000" },
  { code: "3300", nameTh: "กำไรสะสม", nameEn: "Retained earnings", type: "equity", parentCode: "3000" },

  // 4xxx Revenue
  { code: "4000", nameTh: "รายได้", nameEn: "Revenue", type: "revenue" },
  { code: "4010", nameTh: "รายได้จากการขาย", nameEn: "Sales revenue", type: "revenue", parentCode: "4000" },
  { code: "4020", nameTh: "ส่วนลดจ่าย (Contra-revenue)", nameEn: "Sales discounts", type: "revenue", parentCode: "4000" },
  { code: "4030", nameTh: "รับคืนสินค้า (Contra-revenue)", nameEn: "Sales returns", type: "revenue", parentCode: "4000" },
  { code: "4900", nameTh: "รายได้อื่น", nameEn: "Other income", type: "revenue", parentCode: "4000" },

  // 5xxx Expenses
  { code: "5000", nameTh: "ค่าใช้จ่าย", nameEn: "Expenses", type: "expense" },
  { code: "5010", nameTh: "ต้นทุนสินค้าขาย (COGS)", nameEn: "Cost of goods sold", type: "expense", parentCode: "5000" },
  { code: "5100", nameTh: "ค่าใช้จ่ายในการขาย", nameEn: "Selling expenses", type: "expense", parentCode: "5000" },
  { code: "5200", nameTh: "ค่าใช้จ่ายในการบริหาร", nameEn: "Admin expenses", type: "expense", parentCode: "5000" },
  { code: "5910", nameTh: "ผลต่างเงินสด (over/short)", nameEn: "Cash over/short", type: "expense", parentCode: "5000" },
  { code: "5990", nameTh: "ค่าใช้จ่ายเบ็ดเตล็ด", nameEn: "Miscellaneous expenses", type: "expense", parentCode: "5000" },
];

export const THAI_TAX_CODES = [
  { code: "VAT7", name: "ภาษีมูลค่าเพิ่ม 7%", rate: 0.07, outputAccountCode: "2151", inputAccountCode: "1156" },
  { code: "VAT0", name: "ภาษีมูลค่าเพิ่ม 0% (ส่งออก)", rate: 0.0, outputAccountCode: "2151", inputAccountCode: "1156" },
  { code: "EXEMPT", name: "ยกเว้นภาษีมูลค่าเพิ่ม", rate: 0.0, outputAccountCode: "2151", inputAccountCode: "1156" },
] as const;
