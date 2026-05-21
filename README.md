# Khaodee (ขายดี) — POS + Accounting for Thai Retail

> **Open-source POS ที่ดีพอจนการต้องเสียเงินใช้รู้สึกเหมือนเสียท่า**

ระบบ POS + บัญชีคู่ + ภาษีมูลค่าเพิ่มไทย สำหรับร้านขายปลีก — รัน self-host เอง offline-capable, ไม่มีค่ารายเดือน

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

## สถานะปัจจุบัน

**Pre-alpha · กำลังพัฒนา · MVP target 14 วัน**

| วัน | งาน | สถานะ |
|---|---|---|
| D1 | Workspace + Drizzle schema + accounting engine + CI | 🟡 |
| D2 | Hono server + auth + products CRUD + migrations | ⬜ |
| D3 | Cashier shell + cart + VAT totals | ⬜ |
| D4 | Tax invoice numbering (server-authoritative) | ⬜ |
| D5 | Accounting tests (50+ balanced-entry cases) | ⬜ |
| D6 | Cash payment + receipt render | ⬜ |
| D7 | Network thermal printer (TCP 9100, ESC/POS) | ⬜ |
| D8 | PromptPay QR + reconciliation | ⬜ |
| D9 | Offline mode (sql.js + IndexedDB queue) | ⬜ |
| D10 | Yjs catalog sync | ⬜ |
| D11 | Admin: chart of accounts + reports (P&L, BS, TB) | ⬜ |
| D12 | FIFO inventory + ภพ.30 export | ⬜ |
| D13 | Audit log + PDPA + loyalty | ⬜ |
| D14 | E2E tests + Docker compose + screencast | ⬜ |

## Features (เป้าหมาย v0.1)

- 📱 Cashier app (Svelte PWA) + Admin app
- 💰 ขายเงินสด + PromptPay QR (dynamic, with auto-verify ผ่าน slip-to-ledger)
- 🧾 ใบกำกับภาษีอย่างย่อ format ถูกกฎหมายไทย, sequential numbering server-authoritative
- 📚 บัญชีคู่จริงๆ (TFRS for SMEs) — ทุกการขายสร้าง journal entry ที่ balance
- 📊 Trial Balance, P&L, Balance Sheet, Inventory valuation
- 🏛️ ภพ.30 CSV export พร้อมส่งกรมสรรพากร
- 📦 FIFO inventory พร้อม COGS journal สิ้นเดือน
- 🖨️ Network thermal printer (XPrinter, Epson TM-T82) + Thai font rendering
- 🔍 Barcode scanner (USB HID) + camera QR scanner
- 👥 Customer loyalty + PDPA consent flow
- 🔒 Audit log hash-chained, append-only (5-year retention)
- 🌐 Self-host ผ่าน `docker compose up`, ไม่ต้อง SaaS

## Stack

- **Frontend:** SvelteKit (PWA) — apps/cashier, apps/admin
- **Backend:** Hono + Node, single process
- **Database:** SQLite (better-sqlite3 server, sql.js client)
- **ORM:** Drizzle
- **Sync:** Yjs CRDT (catalog) + HTTP (numbers, journals)
- **Hardware:** escpos-buffer (network primary), WebUSB (Chrome desktop only)
- **License:** AGPL-3.0

## โครงสร้าง

```
khaodee/
├── apps/cashier/       # POS UI สำหรับแคชเชียร์
├── apps/admin/         # บริหาร, รายงาน, บัญชี
├── packages/
│   ├── db/             # Drizzle schema + migrations
│   ├── accounting/     # double-entry engine + Thai chart of accounts
│   ├── shared/         # zod schemas, Thai utils
│   ├── sync/           # Yjs + offline queue
│   ├── hardware/       # printer + scanner abstractions
│   ├── reports/        # P&L, BS, ภพ.30 builders
│   └── etax/           # e-Tax XML scaffolds (post-MVP)
├── server/             # Hono API + WebSocket
└── docker-compose.yml
```

## Quick start (dev)

```bash
git clone <repo>
cd khaodee
pnpm install
pnpm test          # run all tests
pnpm dev:server    # start Hono backend
pnpm dev:cashier   # start cashier UI
pnpm dev:admin     # start admin UI
```

## Thai compliance

โปรเจ็คนี้ตั้งใจให้ใช้งานได้จริงในร้านไทย — ออกใบกำกับภาษีถูกกฎหมาย, มี audit log, retention 5 ปี ตามมาตรฐาน

> **คำเตือน:** chart of accounts และ tax codes ถูกออกแบบตามมาตรฐาน TFRS for SMEs แต่ก่อนนำไปใช้กับร้านจริง ควรให้ผู้สอบบัญชีไทยตรวจสอบ

ดู [docs/thai-compliance.md](docs/thai-compliance.md) สำหรับรายละเอียด

## Related projects

- [slip-to-ledger](https://github.com/FirstPrinciples-Sun/slip-to-ledger) — OCR สลิปไทย → JSON. ถูก integrate ใน Khaodee สำหรับ verify การชำระเงิน PromptPay

## License

[AGPL-3.0](LICENSE) — fork ได้ แต่ถ้าทำเป็น SaaS ต้องเปิด source ตามต่อ
