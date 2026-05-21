# Thai Compliance Notes

> โปรเจ็ค Khaodee ออกแบบให้ใช้งานในร้านไทยได้จริงตามกฎหมาย แต่ก่อน deploy production ต้องให้ผู้สอบบัญชี/ทนายความตรวจสอบ

## VAT (ภาษีมูลค่าเพิ่ม)

- อัตราปัจจุบัน 7%
- ต้องจดทะเบียน VAT เมื่อยอดขายเกิน 1.8 ล้านบาท/ปี
- POS Khaodee ออก **ใบกำกับภาษีอย่างย่อ** ตามมาตรา 86/4 ประมวลรัษฎากร

### ใบกำกับภาษีอย่างย่อ ฟิลด์ที่ต้องมี
1. ✅ คำว่า "ใบกำกับภาษีอย่างย่อ" (รองรับใน receipt template)
2. ✅ ชื่อ + เลขประจำตัวผู้เสียภาษีอากร (TIN) ของผู้ขาย
3. ✅ เลขที่ลำดับใบกำกับภาษี (Khaodee: T1-2026-000123 — server-authoritative)
4. ✅ วัน เดือน ปี ที่ออก
5. ✅ รายการสินค้า/บริการ (ชื่อ + จำนวน + ราคา)
6. ✅ จำนวนเงินรวม (ระบุว่ารวม VAT แล้ว: "ราคารวมภาษีมูลค่าเพิ่มแล้ว")

## บัญชีคู่ (Double-Entry Bookkeeping)

ระบบบัญชีของ Khaodee ใช้ **TFRS for SMEs** (มาตรฐานการรายงานทางการเงินสำหรับกิจการขนาดกลางและขนาดเล็ก)

### Chart of Accounts ที่ pre-seed
- **1xxx Assets** — เงินสด, เงินฝากธนาคาร, ลูกหนี้, สินค้าคงเหลือ, VAT ซื้อ
- **2xxx Liabilities** — เจ้าหนี้, VAT ขาย, ภาษีหัก ณ ที่จ่ายค้างจ่าย
- **3xxx Equity** — ทุนจดทะเบียน, กำไรสะสม
- **4xxx Revenue** — รายได้จากการขาย, ส่วนลดจ่าย, รับคืนสินค้า, รายได้อื่น
- **5xxx Expenses** — COGS, ค่าใช้จ่ายขาย/บริหาร, ผลต่างเงินสด, เบ็ดเตล็ด

### การลงบัญชี
- ทุกการขายสร้าง journal entry ที่ **บังคับให้ debit = credit**
- Cash sale: Dr Cash / Cr Sales / Cr VAT Output
- Refund = mirror reversal entry
- Day-end: cash drawer reconciliation → over/short → 5910

## ภพ.30 (VAT รายเดือน)

- กำหนดยื่นภายในวันที่ 15 ของเดือนถัดไป
- Khaodee export CSV ตามคอลัมน์: เดือน, ปี, ยอดขาย, ภาษีขาย, ยอดซื้อ, ภาษีซื้อ, ภาษีต้องชำระ
- Endpoint: `GET /api/reports/pp30.csv?shopId=X&year=2026&month=5`

## ภงด อื่นๆ (ยังไม่ได้ implement — v0.2)
- ภงด.1/3/53 — ภาษีหัก ณ ที่จ่ายรายเดือน (สำหรับจ่ายให้ vendor, ไม่ใช่ retail-to-consumer)
- ภงด.50/51 — ภาษีนิติบุคคลรายปี

## e-Tax Invoice (ยังไม่ได้ implement — v0.2)
- กรมสรรพากรเปิดให้สมัครใช้แบบสมัครใจที่ etax.rd.go.th
- ต้อง CA-signed XML
- Khaodee schema มี `e_tax_documents` table เตรียมไว้

## PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล)

- Customer phone/loyalty: ต้องขอ consent (มี `customer_consents` table + UI flow)
- Retention: เก็บ 5 ปี (ตามกฎหมายภาษี) แล้วลบ
- Khaodee soft-delete + monthly archive job (ยังไม่ได้ implement — v0.2)

## Audit Log

- Append-only ด้วย SHA-256 hash chain
- ตรวจสอบ tamper ผ่าน `verifyAuditLog()`
- Endpoint: `GET /api/reports/audit-status?shopId=X` (post-MVP)

## ทดสอบกฎหมายก่อน production
- [ ] ผู้สอบบัญชีตรวจ chart of accounts
- [ ] ทนายตรวจ template ใบกำกับภาษี
- [ ] ทดสอบ ภพ.30 CSV ว่า upload เข้า rd.go.th ได้
- [ ] PDPA: ทำ data subject request flow
- [ ] e-Tax CA signing (ถ้าต้องการ)
