<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, type Product } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let products = $state<Product[]>([]);
  let receiveLines = $state<Array<{ variantId: string; qty: number; unitCostBaht: number }>>([
    { variantId: "", qty: 1, unitCostBaht: 0 },
  ]);
  let supplierName = $state("");
  let reference = $state("");
  let saving = $state(false);
  let msg = $state("");
  let err = $state("");

  // Reorder list
  let reorderItems = $state<any[]>([]);
  let threshold = $state(5);

  // Stock count
  let countLines = $state<Array<{ variantId: string; countedQty: number }>>([
    { variantId: "", countedQty: 0 },
  ]);

  // Tab
  let tab = $state<"receive" | "count" | "reorder" | "transfer">("receive");

  // Transfer
  let transferToShopId = $state("");
  let transferLines = $state<Array<{ variantId: string; qty: number }>>([
    { variantId: "", qty: 1 },
  ]);
  let allShops = $state<any[]>([]);

  async function load() {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    products = await api.products(SHOP_ID);
    const r = await fetch(`${API}/api/inventory/reorder?shopId=${SHOP_ID}&threshold=${threshold}`, { credentials: "include" });
    const j = await r.json();
    reorderItems = j.items ?? [];
    const sr = await fetch(`${API}/api/shops`, { credentials: "include" });
    const sj = await sr.json();
    allShops = (sj.shops ?? []).map((x: any) => x.shop).filter((s: any) => s.id !== SHOP_ID);
  }

  onMount(load);

  async function submitTransfer(e: Event) {
    e.preventDefault();
    err = ""; msg = "";
    saving = true;
    try {
      const r = await fetch(`${API}/api/inventory/transfer`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromShopId: SHOP_ID,
          toShopId: transferToShopId,
          lines: transferLines.filter((l) => l.variantId && l.qty > 0),
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      msg = "โอนสินค้าระหว่างสาขาเรียบร้อย";
      transferLines = [{ variantId: "", qty: 1 }];
      await load();
    } catch (e: any) {
      err = e.message;
    } finally {
      saving = false;
    }
  }
  function addTransferLine() { transferLines = [...transferLines, { variantId: "", qty: 1 }]; }

  async function submitReceive(e: Event) {
    e.preventDefault();
    err = ""; msg = "";
    saving = true;
    try {
      const r = await fetch(`${API}/api/inventory/receive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID,
          reference,
          lines: receiveLines
            .filter((l) => l.variantId && l.qty > 0)
            .map((l) => ({ variantId: l.variantId, qty: l.qty, unitCostSatang: Math.round(l.unitCostBaht * 100) })),
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      const j = await r.json();
      msg = `รับสินค้าเข้าเรียบร้อย ยอด ฿${(j.totalCostSatang / 100).toLocaleString("th-TH")}`;
      receiveLines = [{ variantId: "", qty: 1, unitCostBaht: 0 }];
      reference = "";
      await load();
    } catch (e: any) {
      err = e.message;
    } finally {
      saving = false;
    }
  }

  async function submitCount(e: Event) {
    e.preventDefault();
    err = ""; msg = "";
    saving = true;
    try {
      const r = await fetch(`${API}/api/inventory/count`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID,
          lines: countLines.filter((l) => l.variantId),
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      const j = await r.json();
      msg = `นับสต็อกเรียบร้อย — ปรับ ${j.adjustments.filter((a: any) => a.delta !== 0).length} รายการ`;
      countLines = [{ variantId: "", countedQty: 0 }];
      await load();
    } catch (e: any) {
      err = e.message;
    } finally {
      saving = false;
    }
  }

  function addReceiveLine() { receiveLines = [...receiveLines, { variantId: "", qty: 1, unitCostBaht: 0 }]; }
  function addCountLine() { countLines = [...countLines, { variantId: "", countedQty: 0 }]; }

  // Flatten products → list of variants for select
  const allVariants = $derived(
    products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))),
  );

  function variantLabel(v: any): string {
    return `${v.productName}${v.name ? ` — ${v.name}` : ""} (${v.sku})`;
  }
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">คลังสินค้า</h1>

  <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border);">
    <button class="btn ghost" class:active={tab === "receive"} style:background={tab === "receive" ? "var(--accent-soft)" : ""} onclick={() => (tab = "receive")}>รับสินค้าเข้า</button>
    <button class="btn ghost" class:active={tab === "count"} style:background={tab === "count" ? "var(--accent-soft)" : ""} onclick={() => (tab = "count")}>นับสต็อก</button>
    <button class="btn ghost" class:active={tab === "transfer"} style:background={tab === "transfer" ? "var(--accent-soft)" : ""} onclick={() => (tab = "transfer")}>โอนระหว่างสาขา</button>
    <button class="btn ghost" class:active={tab === "reorder"} style:background={tab === "reorder" ? "var(--accent-soft)" : ""} onclick={() => (tab = "reorder")}>สินค้าใกล้หมด ({reorderItems.length})</button>
  </div>

  {#if msg}<div style="padding: 12px; background: var(--accent-soft); border-radius: 8px; margin-bottom: 16px;">{msg}</div>{/if}
  {#if err}<div style="padding: 12px; background: rgba(196,83,58,0.1); color: var(--error); border-radius: 8px; margin-bottom: 16px;">{err}</div>{/if}

  {#if tab === "receive"}
    <form onsubmit={submitReceive} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px;">
      <label style="display: block; margin-bottom: 16px;">
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เลขที่อ้างอิง / supplier reference</span>
        <input bind:value={reference} placeholder="PO-001 / ใบส่งของ" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
      </label>

      {#each receiveLines as line, i}
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px; align-items:end;">
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">สินค้า</span>{/if}
            <select bind:value={line.variantId} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;">
              <option value="">— เลือก —</option>
              {#each allVariants as v}
                <option value={v.id}>{variantLabel(v)}</option>
              {/each}
            </select>
          </label>
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">จำนวน</span>{/if}
            <input type="number" step="0.01" bind:value={line.qty} min="0.01" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
          </label>
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ต้นทุน/หน่วย (฿)</span>{/if}
            <input type="number" step="0.01" bind:value={line.unitCostBaht} min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
          </label>
        </div>
      {/each}

      <button type="button" class="btn ghost" onclick={addReceiveLine} style="margin-top: 8px;">+ เพิ่มรายการ</button>

      <div style="margin-top: 24px;">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? "..." : "บันทึกรับสินค้า"}</button>
      </div>
    </form>
  {/if}

  {#if tab === "count"}
    <form onsubmit={submitCount} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px;">
      <p style="color: var(--muted); margin-bottom: 16px;">ใส่จำนวนที่นับได้จริง — ระบบจะปรับสต็อกและบันทึก over/short</p>

      {#each countLines as line, i}
        <div style="display:grid; grid-template-columns: 3fr 1fr; gap: 8px; margin-bottom: 8px; align-items:end;">
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">สินค้า</span>{/if}
            <select bind:value={line.variantId} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;">
              <option value="">— เลือก —</option>
              {#each allVariants as v}
                <option value={v.id}>{variantLabel(v)} (มี {(v as any).stockQty ?? 0})</option>
              {/each}
            </select>
          </label>
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">นับได้ (หน่วย)</span>{/if}
            <input type="number" step="0.01" bind:value={line.countedQty} min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
          </label>
        </div>
      {/each}

      <button type="button" class="btn ghost" onclick={addCountLine} style="margin-top: 8px;">+ เพิ่มรายการ</button>

      <div style="margin-top: 24px;">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? "..." : "บันทึกผลการนับ"}</button>
      </div>
    </form>
  {/if}

  {#if tab === "transfer"}
    <form onsubmit={submitTransfer} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px;">
      <p style="color: var(--muted); margin-bottom: 16px;">โอนสินค้าจากสาขานี้ ({SHOP_ID}) ไปสาขาอื่น</p>

      <label style="display: block; margin-bottom: 16px;">
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">โอนไปยังสาขา</span>
        <select bind:value={transferToShopId} required style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px;">
          <option value="">— เลือกสาขา —</option>
          {#each allShops as s}
            <option value={s.id}>{s.name} ({s.id})</option>
          {/each}
        </select>
      </label>

      {#if allShops.length === 0}
        <p style="color: var(--warning); padding: 16px; background: var(--surface-2); border-radius: 6px; margin-bottom: 16px;">
          ⚠ ยังไม่มีสาขาอื่น — สร้างผ่าน <code>POST /api/shops</code> ก่อน
        </p>
      {/if}

      {#each transferLines as line, i}
        <div style="display:grid; grid-template-columns: 3fr 1fr; gap: 8px; margin-bottom: 8px; align-items:end;">
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">สินค้า</span>{/if}
            <select bind:value={line.variantId} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;">
              <option value="">— เลือก —</option>
              {#each allVariants as v}
                <option value={v.id}>{variantLabel(v)} (มี {(v as any).stockQty ?? 0})</option>
              {/each}
            </select>
          </label>
          <label>
            {#if i === 0}<span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">จำนวน</span>{/if}
            <input type="number" step="0.01" bind:value={line.qty} min="0.01" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
          </label>
        </div>
      {/each}

      <button type="button" class="btn ghost" onclick={addTransferLine} style="margin-top: 8px;">+ เพิ่มรายการ</button>

      <div style="margin-top: 24px;">
        <button class="btn primary" type="submit" disabled={saving || !transferToShopId}>{saving ? "..." : "โอนสินค้า"}</button>
      </div>
    </form>
  {/if}

  {#if tab === "reorder"}
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px;">
      <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 16px;">
        <span>เกณฑ์ stock ต่ำกว่า:</span>
        <input type="number" bind:value={threshold} min="0" style="width: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 6px;" onchange={load} />
      </div>

      {#if reorderItems.length === 0}
        <p style="color: var(--muted); padding: 32px; text-align: center;">ทุกอย่าง stock พอ — ไม่มีสินค้าต่ำกว่าเกณฑ์</p>
      {:else}
        <table style="width:100%; border-collapse: collapse;">
          <thead style="background: var(--surface-2);">
            <tr>
              <th style="padding: 12px; text-align: left;">สินค้า</th>
              <th style="padding: 12px; text-align: left;">SKU</th>
              <th style="padding: 12px; text-align: right;">คงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {#each reorderItems as item}
              <tr style="border-top: 1px solid var(--border);">
                <td style="padding: 12px;">{item.product_name}{item.variant_name ? ` — ${item.variant_name}` : ""}</td>
                <td style="padding: 12px; font-family: var(--font-mono); font-size: 13px; color: var(--muted);">{item.sku}</td>
                <td style="padding: 12px; text-align: right; font-variant-numeric: tabular-nums; color: {item.qty <= 0 ? 'var(--error)' : 'var(--warning)'};">{item.qty}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</main>
