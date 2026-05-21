# Khaodee (ขายดี) — POS + Accounting for Thai Retail

> **Open-source POS ที่ดีพอจนการต้องเสียเงินใช้รู้สึกเหมือนเสียท่า**

ระบบ POS + บัญชีคู่ + ภาษีมูลค่าเพิ่มไทย + พนักงาน + คลังสินค้า + ส่วนลด/บัตรเงินสด/พักบิล/ลูกค้า — สำหรับร้านขายปลีก รัน self-host เอง offline-capable, ไม่มีค่ารายเดือน

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

## สถานะปัจจุบัน — Active development (post-v0.1.0)

ความคืบหน้าฟีเจอร์ที่ shipped:

| โมดูล | สถานะ |
|---|---|
| ✅ Auth + multi-shop + roles (owner/manager/cashier/accountant) | done |
| ✅ Cashier UI: drag-drop POS, cart, totals incl VAT, cash payment | done |
| ✅ Tax invoice numbering server-authoritative (T1-2026-000123) | done |
| ✅ Double-entry accounting + Thai chart of accounts (TFRS for SMEs) | done |
| ✅ Trial Balance · P&L · Balance Sheet · ภพ.30 CSV export | done |
| ✅ Journal explorer with all entries Dr/Cr | done |
| ✅ Audit log SHA-256 hash chain | done |
| ✅ PromptPay QR generator (EMVCo, CRC verified) | done |
| ✅ Network thermal printer abstraction (TCP 9100 ESC/POS) | done |
| ✅ **Warehouse: รับเข้า · นับสต็อก · reorder alerts · multi-shop transfer** | done |
| ✅ **HR: พนักงาน · payroll คำนวณ Thai PIT + SSO · post to ledger** | done |
| ✅ **Retail: discounts · gift cards · held bills · customers + loyalty** | done |
| 🟡 UI สำหรับ retail features | in progress |
| ⬜ Split payment ที่ POS | next |
| ⬜ Role-based PIN switching | next |
| ⬜ Offline PWA + Yjs sync | post-MVP |
| ⬜ e-Tax invoice XML + CA digital signature | post-MVP |
| ⬜ Tauri desktop wrapper | post-MVP |

**Tests:** 43/43 accounting (incl. 7 payroll), all 8 packages typecheck clean

## Features (สรุป)

### POS / Cashier
- 📱 Drag-drop product grid + cart sidebar
- 🧾 ใบกำกับภาษีอย่างย่อ + sequential numbering (server-authoritative)
- 💰 Cash + PromptPay QR (auto-generate dynamic QR)
- 🎟️ ส่วนลดด้วยโค้ด, บัตรเงินสด, พักบิล (พักไว้ + เรียกคืน)

### Inventory / Warehouse
- 📦 รับสินค้าเข้า → +stock + journal Dr Inventory / Cr Cash
- 📊 Cycle count → over/short adjustment
- 🚨 Reorder alerts (เกณฑ์ปรับได้)
- 🔄 Multi-shop transfer

### HR / Payroll
- 👥 จัดการพนักงาน + บทบาท + เลขประจำตัวผู้เสียภาษี
- 💵 คำนวณเงินเดือนรายเดือน — Thai PIT brackets 2024+ (8 ระดับ 0-35%)
- 🏥 SSO 5% capped 750 บาท/เดือน (ฝั่ง employee + employer)
- 📝 OT, โบนัส, รายได้อื่น, หักอื่น
- 📚 Post to ledger → balanced journal entry: Dr Salary + Dr Employer SSO / Cr Cash + Cr WHT + Cr SSO Payable

### Accounting
- 📚 Double-entry บังคับ debit = credit ทุก entry
- 📋 TFRS for SMEs chart preseeded (4 sections + 25+ accounts)
- 📊 Trial Balance, P&L, Balance Sheet (real-time)
- 🏛️ ภพ.30 CSV export พร้อมส่งกรมสรรพากร
- 🔒 Audit log hash-chained (5-year retention)

### Customer
- 👤 Customer search + add (เบอร์, ชื่อ)
- 🎁 Loyalty points
- ✅ PDPA consent flow

### Retail Features
- 🎟️ ส่วนลดด้วยโค้ด (percent + fixed) พร้อมเงื่อนไขขั้นต่ำ + ระยะเวลา
- 💳 Gift cards (ออก + redeem + ดู balance)
- ⏸️ พักบิล (Hold/park bill) → save cart, resume ได้ภายหลัง

### Hardware
- 🖨️ Network thermal printer (TCP 9100, ESC/POS, 384px raster)
- 📷 USB HID barcode scanner (keyboard-wedge)
- 🔓 Cash drawer trigger via printer DK pin

## Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes) — apps/cashier
- **Backend:** Hono + Node, single process
- **Database:** SQLite via better-sqlite3, single file
- **ORM:** Drizzle (.sql migrations)
- **Validation:** Zod
- **License:** AGPL-3.0

## โครงสร้างโปรเจ็ค

```
khaodee/
├── apps/cashier/                 # SvelteKit POS UI (6 routes)
│   ├── /login        # auth + auto-bootstrap demo shop
│   ├── /cashier      # POS — product grid + cart + cash payment
│   ├── /products     # add/edit + stock per variant
│   ├── /warehouse    # 3 tabs: receive · count · reorder
│   ├── /hr           # 2 tabs: employees · payroll
│   ├── /reports      # P&L summary cards + Trial Balance + ภพ.30 CSV
│   └── /journal      # all journal entries with Dr/Cr lines
├── packages/
│   ├── db/                       # Drizzle schema + migrations
│   ├── accounting/               # double-entry + Thai PIT + payroll
│   ├── shared/                   # Thai utils, PromptPay, TIN validators
│   ├── reports/                  # P&L, BS, TB, ภพ.30 builders
│   └── hardware/                 # NetworkPrinter (ESC/POS over TCP)
├── server/                       # Hono API
│   └── src/routes/
│       ├── auth.ts               # register, login, logout, me
│       ├── shops.ts              # create shop + terminals
│       ├── products.ts           # CRUD with variant + stock
│       ├── tx.ts                 # commit sale + assign invoice + journal
│       ├── inventory.ts          # receive, count, transfer, reorder
│       ├── hr.ts                 # employees, payroll runs
│       ├── retail.ts             # discounts, giftcards, held bills, customers
│       └── reports.ts            # all financial reports
└── docker-compose.yml
```

## Quick start (dev)

```bash
git clone https://github.com/FirstPrinciples-Sun/khaodee
cd khaodee
pnpm install
pnpm dev:server          # Hono on :3000
pnpm dev:cashier         # SvelteKit on :5174
```

เปิด http://localhost:5174 → register → ระบบ auto-bootstrap demo shop + terminal → เริ่มใช้ได้เลย

```bash
pnpm -r test             # 43/43 accounting tests pass
pnpm -r typecheck        # all 8 packages green
```

## Self-host

```bash
docker compose up
```

SQLite ที่ `data/khaodee.db` mount เป็น Docker volume — backup = copy ไฟล์เดียว

## Thai compliance

โปรเจ็คนี้ตั้งใจให้ใช้งานได้จริงในร้านไทย — ออกใบกำกับภาษีถูกกฎหมาย, มี audit log, retention 5 ปี

> **คำเตือน:** Chart of accounts, tax codes, payroll calculation ถูกออกแบบตามมาตรฐาน TFRS for SMEs + Revenue Department brackets ปี 2024+ แต่ก่อนนำไปใช้กับร้านจริง **ควรให้ผู้สอบบัญชีไทยตรวจสอบ**

ดู [docs/thai-compliance.md](docs/thai-compliance.md)

## Related projects

- [slip-to-ledger](https://github.com/FirstPrinciples-Sun/slip-to-ledger) — OCR สลิปไทย → JSON. ผูกกับ Khaodee สำหรับ verify การชำระ PromptPay

## License

[AGPL-3.0](LICENSE) — fork ได้ แต่ถ้าทำเป็น SaaS ต้องเปิด source ตาม
