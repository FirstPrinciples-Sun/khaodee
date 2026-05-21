/**
 * PromptPay QR generator (EMVCo Merchant-Presented Mode + Thai extensions).
 *
 * Generates static or dynamic QR strings that any Thai banking app can pay.
 * Spec: BOT PromptPay specification + EMVCo MPM v1.x.
 *
 * Output is a TLV string that should be encoded as QR (use any QR library).
 */

export interface PromptPayInput {
  /** PromptPay ID: phone (10 digits, '0xxxxxxxxx') or national ID (13 digits) or e-wallet */
  promptpayId: string;
  /** Optional amount in baht. If undefined, generates a static QR (customer enters amount). */
  amountBaht?: number;
  /** Currency code (default 764 = THB). */
  currency?: string;
  /** Country code (default TH). */
  country?: string;
}

export function generatePromptPayQrPayload(input: PromptPayInput): string {
  const isDynamic = typeof input.amountBaht === "number" && input.amountBaht > 0;
  const cleanId = input.promptpayId.replace(/[-\s]/g, "");

  // Determine ID sub-tag (01 = mobile, 02 = national ID, 03 = e-wallet)
  let subTag: string;
  let value: string;
  if (/^0\d{9}$/.test(cleanId)) {
    subTag = "01";
    value = "0066" + cleanId.slice(1); // 0066 + 9 digits = 13
  } else if (/^\d{13}$/.test(cleanId)) {
    subTag = "02";
    value = cleanId;
  } else if (/^\d{15}$/.test(cleanId)) {
    subTag = "03";
    value = cleanId;
  } else {
    throw new Error(`Invalid PromptPay ID: ${cleanId}`);
  }

  const aid = tlv("00", "A000000677010111");
  const idTlv = tlv(subTag, value);
  const merchantAccount = tlv("29", aid + idTlv);

  let payload =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", isDynamic ? "12" : "11") + // 11 static, 12 dynamic
    merchantAccount +
    tlv("53", input.currency ?? "764") +
    (isDynamic ? tlv("54", input.amountBaht!.toFixed(2)) : "") +
    tlv("58", input.country ?? "TH");

  payload += "6304"; // CRC tag + length placeholder
  const crc = crc16CcittFalse(payload);
  payload += crc.toString(16).toUpperCase().padStart(4, "0");
  return payload;
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return tag + len + value;
}

function crc16CcittFalse(s: string): number {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
