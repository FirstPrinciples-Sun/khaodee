/** Format satang as Thai baht string with thousands separator. */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  return baht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compute VAT-exclusive subtotal from VAT-inclusive total. */
export function vatExclSubtotal(totalSatang: number, vatRate = 0.07): number {
  return Math.round(totalSatang / (1 + vatRate));
}

/** Compute VAT amount from VAT-inclusive total. */
export function vatFromInclusive(totalSatang: number, vatRate = 0.07): number {
  return totalSatang - vatExclSubtotal(totalSatang, vatRate);
}

/** Validate Thai TIN: 13 digits with checksum. */
export function isValidThaiTin(tin: string): boolean {
  if (!/^\d{13}$/.test(tin)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(tin[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(tin[12]);
}

/** Validate Thai mobile or national ID for PromptPay. */
export function isValidPromptPayId(id: string): boolean {
  const digits = id.replace(/[-\s]/g, "");
  if (/^0\d{9}$/.test(digits)) return true; // mobile
  if (/^\d{13}$/.test(digits)) return isValidThaiTin(digits); // citizen ID
  return false;
}
