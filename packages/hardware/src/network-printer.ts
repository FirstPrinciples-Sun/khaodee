/**
 * Network thermal printer over TCP 9100 (Epson ESC/POS).
 *
 * Most Thai shops use XPrinter / Epson TM-T82 / Star TSP series. They speak
 * raw ESC/POS over port 9100. We render Thai text as a 384px-wide raster
 * image (most cheap printers lack Thai font ROM) and send it as GS v 0
 * raster command.
 *
 * Image rendering happens elsewhere (Canvas API in browser, sharp in Node).
 * This class only handles the ESC/POS command building + TCP send.
 */

import { Socket } from "node:net";
import type { IReceiptPrinter, ReceiptDoc, PrinterStatus } from "./printer";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const INIT = Buffer.from([ESC, 0x40]);
const CUT = Buffer.from([GS, 0x56, 0x00]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const CASH_DRAWER = Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);

export interface NetworkPrinterOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
  /** Function that renders a ReceiptDoc to a 384px-wide 1-bit bitmap. */
  rasterize?: (doc: ReceiptDoc) => Promise<Buffer>;
}

export class NetworkPrinter implements IReceiptPrinter {
  constructor(private opts: NetworkPrinterOptions) {}

  async print(doc: ReceiptDoc): Promise<void> {
    const buf: Buffer[] = [INIT];

    if (this.opts.rasterize) {
      const raster = await this.opts.rasterize(doc);
      buf.push(rasterImage(raster, 384));
    } else {
      // Text-only fallback (no Thai support — for testing English receipts)
      buf.push(textReceipt(doc));
    }

    buf.push(Buffer.from([LF, LF, LF, LF]));
    buf.push(CUT);
    await this.sendBytes(Buffer.concat(buf));
  }

  async status(): Promise<PrinterStatus> {
    try {
      await this.sendBytes(Buffer.from([0x10, 0x04, 0x01]), 1500);
      return { online: true, paper: true };
    } catch {
      return { online: false, paper: false };
    }
  }

  async cutPaper(): Promise<void> {
    await this.sendBytes(CUT);
  }

  async openCashDrawer(): Promise<void> {
    await this.sendBytes(CASH_DRAWER);
  }

  private sendBytes(data: Buffer, timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.opts.timeoutMs ?? 5000;
    return new Promise<void>((resolve, reject) => {
      const sock = new Socket();
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`printer timeout ${this.opts.host}:${this.opts.port ?? 9100}`));
      }, t);
      sock.connect(this.opts.port ?? 9100, this.opts.host, () => {
        sock.write(data, () => {
          sock.end();
          clearTimeout(timer);
          resolve();
        });
      });
      sock.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }
}

function textReceipt(doc: ReceiptDoc): Buffer {
  const out: Buffer[] = [];
  const txt = (s: string) => out.push(Buffer.from(s + "\n", "utf8"));

  out.push(ALIGN_CENTER, BOLD_ON);
  txt(doc.shopName);
  out.push(BOLD_OFF);
  if (doc.shopTin) txt(`TIN: ${doc.shopTin}`);
  if (doc.shopAddress) txt(doc.shopAddress);
  txt(`Invoice: ${doc.invoiceNumber}`);
  txt(doc.issuedAt.toLocaleString("en-GB"));
  out.push(ALIGN_LEFT);
  txt("--------------------------------");
  for (const l of doc.lines) {
    txt(`${l.qty}x ${l.name}`);
    txt(`   ${(l.lineTotalSatang / 100).toFixed(2)}`);
  }
  txt("--------------------------------");
  txt(`Subtotal:       ${(doc.subtotalSatang / 100).toFixed(2)}`);
  txt(`VAT 7%:         ${(doc.vatSatang / 100).toFixed(2)}`);
  out.push(BOLD_ON);
  txt(`TOTAL:          ${(doc.totalSatang / 100).toFixed(2)}`);
  out.push(BOLD_OFF);
  txt(`Pay (${doc.paymentMethod}):     ${((doc.receivedSatang ?? doc.totalSatang) / 100).toFixed(2)}`);
  if (doc.changeSatang) txt(`Change:         ${(doc.changeSatang / 100).toFixed(2)}`);
  return Buffer.concat(out);
}

function rasterImage(bitmap: Buffer, widthPx: number): Buffer {
  const widthBytes = Math.ceil(widthPx / 8);
  const heightPx = bitmap.length / widthBytes;
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = heightPx & 0xff;
  const yH = (heightPx >> 8) & 0xff;
  const header = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([header, bitmap]);
}
