import { describe, it, expect } from "vitest";
import { generatePromptPayQrPayload } from "./promptpay";

describe("PromptPay QR", () => {
  it("generates static mobile QR with valid CRC", () => {
    const payload = generatePromptPayQrPayload({ promptpayId: "0812345678" });
    expect(payload).toMatch(/^00020101021129/); // PFI + static + merchant tag
    expect(payload.length).toBeGreaterThan(40);
    expect(payload.slice(-8, -4)).toBe("6304"); // CRC marker
  });

  it("generates dynamic QR with amount", () => {
    const payload = generatePromptPayQrPayload({ promptpayId: "0812345678", amountBaht: 250.5 });
    expect(payload).toContain("0212"); // dynamic init
    expect(payload).toContain("5406250.50"); // amount tag length 06 value "250.50"
  });

  it("accepts national ID (13 digits)", () => {
    const payload = generatePromptPayQrPayload({ promptpayId: "1234567890123" });
    expect(payload).toContain("0213"); // sub-tag 02 length 13
  });

  it("rejects invalid id", () => {
    expect(() => generatePromptPayQrPayload({ promptpayId: "abc" })).toThrow();
  });

  it("CRC verifies (round-trip)", () => {
    const payload = generatePromptPayQrPayload({ promptpayId: "0812345678", amountBaht: 100 });
    const body = payload.slice(0, -4);
    const claimed = parseInt(payload.slice(-4), 16);
    let crc = 0xffff;
    for (let i = 0; i < body.length; i++) {
      crc ^= body.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    expect(crc).toBe(claimed);
  });
});
