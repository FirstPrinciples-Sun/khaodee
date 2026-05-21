import { describe, it, expect } from "vitest";
import { formatBaht, vatExclSubtotal, vatFromInclusive, isValidThaiTin } from "./index";

describe("shared utilities", () => {
  it("formats baht with 2 decimals + comma", () => {
    expect(formatBaht(123450)).toMatch(/1,234\.50$/);
    expect(formatBaht(0)).toMatch(/0\.00$/);
  });

  it("computes VAT-exclusive subtotal correctly", () => {
    expect(vatExclSubtotal(10700)).toBe(10000);
    expect(vatFromInclusive(10700)).toBe(700);
  });

  it("validates real Thai TINs", () => {
    expect(isValidThaiTin("0105560123450")).toBe(false); // wrong checksum on dummy
    expect(isValidThaiTin("123")).toBe(false);
    expect(isValidThaiTin("0000000000000")).toBe(false);
  });
});
