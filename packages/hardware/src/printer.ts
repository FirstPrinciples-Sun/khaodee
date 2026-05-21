/**
 * Receipt printer abstraction.
 *
 * Day-1 backends:
 *   - NetworkPrinter (TCP 9100, ESC/POS commands + Thai raster image)
 *   - MockPrinter (logs to console, used in tests)
 *
 * Browser-only backends (D11 stretch):
 *   - WebUSBPrinter (Chrome/Edge desktop)
 */

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

export interface ReceiptDoc {
  shopName: string;
  shopTin?: string;
  shopAddress?: string;
  shopPhone?: string;
  invoiceNumber: string;
  type: "abbreviated" | "full";
  issuedAt: Date;
  lines: ReceiptLine[];
  subtotalSatang: number;
  vatSatang: number;
  totalSatang: number;
  paymentMethod: string;
  receivedSatang?: number;
  changeSatang?: number;
  qrPayload?: string;
  /** Customer (only for full tax invoice) */
  customer?: { name: string; tin?: string; address?: string };
}

export interface PrinterStatus {
  online: boolean;
  paper: boolean;
}

export interface IReceiptPrinter {
  print(doc: ReceiptDoc): Promise<void>;
  status(): Promise<PrinterStatus>;
  cutPaper(): Promise<void>;
  openCashDrawer?(): Promise<void>;
}

export class MockPrinter implements IReceiptPrinter {
  public lastPrinted: ReceiptDoc | null = null;
  async print(doc: ReceiptDoc) {
    this.lastPrinted = doc;
    console.log("[MockPrinter] printed", doc.invoiceNumber);
  }
  async status() {
    return { online: true, paper: true };
  }
  async cutPaper() {}
  async openCashDrawer() {}
}
