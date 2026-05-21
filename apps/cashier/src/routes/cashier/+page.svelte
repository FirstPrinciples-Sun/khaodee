<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, cart, cartTotals, addToCart, setQty, clearCart, type Product } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let products = $state<Product[]>([]);
  let loading = $state(true);
  let err = $state("");
  let lastInvoice = $state<string | null>(null);

  // Discount
  let discountCode = $state("");
  let discountSatang = $state(0);
  let discountName = $state("");
  let applyingDiscount = $state(false);

  // Hold bills
  let heldBills = $state<any[]>([]);
  let showHeld = $state(false);

  // Payment modal
  let payOpen = $state(false);
  let payments = $state<Array<{ method: "cash" | "promptpay" | "card" | "wallet"; amountBaht: number }>>([
    { method: "cash", amountBaht: 0 },
  ]);

  const totals = $derived.by(() => {
    const t = $cartTotals;
    const afterDiscount = Math.max(0, t.totalSatang - discountSatang);
    const subtotal = Math.round(afterDiscount / 1.07);
    const vat = afterDiscount - subtotal;
    return {
      grossTotal: t.totalSatang,
      discountSatang,
      totalSatang: afterDiscount,
      subtotalSatang: subtotal,
      vatSatang: vat,
      count: t.count,
    };
  });

  const totalPaid = $derived(Math.round(payments.reduce((s, p) => s + (p.amountBaht || 0) * 100, 0)));
  const change = $derived(totalPaid - totals.totalSatang);

  onMount(async () => {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    try {
      products = await api.products(SHOP_ID);
      const r = await fetch(`${API}/api/retail/held?shopId=${SHOP_ID}`, { credentials: "include" });
      const j = await r.json();
      heldBills = j.held ?? [];
    } catch (e: any) { err = e.message; } finally { loading = false; }
  });

  async function applyDiscount() {
    err = "";
    if (!discountCode) return;
    applyingDiscount = true;
    try {
      const r = await fetch(`${API}/api/retail/discounts/apply`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: SHOP_ID, code: discountCode, subtotalSatang: $cartTotals.totalSatang }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      discountSatang = j.discountSatang;
      discountName = j.name;
    } catch (e: any) { err = e.message; discountSatang = 0; discountName = ""; }
    applyingDiscount = false;
  }

  function clearDiscount() { discountCode = ""; discountSatang = 0; discountName = ""; }

  function openPayment() {
    payments = [{ method: "cash", amountBaht: totals.totalSatang / 100 }];
    payOpen = true;
  }

  function addPaymentRow() {
    const remaining = Math.max(0, (totals.totalSatang - totalPaid) / 100);
    payments = [...payments, { method: "cash", amountBaht: remaining }];
  }

  function removePaymentRow(i: number) {
    payments = payments.filter((_, idx) => idx !== i);
  }

  async function commitSale() {
    err = "";
    const lines = $cart.map((l) => ({
      variantId: l.variantId, qty: l.qty,
      unitPriceSatang: l.unitPriceSatang, taxCode: "VAT7" as const,
    }));
    try {
      const result = await api.commitTx({
        shopId: SHOP_ID, terminalId: "demo-terminal", lines,
        payments: payments.filter(p => p.amountBaht > 0).map(p => ({
          method: p.method, amountSatang: Math.round(p.amountBaht * 100),
        })),
        invoiceType: "abbreviated",
      });
      lastInvoice = result.invoiceNumber;
      clearCart();
      clearDiscount();
      payOpen = false;
      payments = [{ method: "cash", amountBaht: 0 }];
    } catch (e: any) { err = e.message; }
  }

  async function holdBill() {
    if ($cart.length === 0) return;
    const label = prompt("ชื่อบิลที่พักไว้ (เช่น 'โต๊ะ 5')") || "ไม่ระบุ";
    try {
      await fetch(`${API}/api/retail/held`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID, terminalId: "demo-terminal", label,
          cart: $cart,
        }),
      });
      const r = await fetch(`${API}/api/retail/held?shopId=${SHOP_ID}`, { credentials: "include" });
      const j = await r.json();
      heldBills = j.held ?? [];
      clearCart();
      clearDiscount();
    } catch (e: any) { err = e.message; }
  }

  async function resumeBill(bill: any) {
    clearCart();
    for (const line of bill.cart) {
      cart.update(items => [...items, line]);
    }
    await fetch(`${API}/api/retail/held/${bill.id}/resume`, { method: "POST", credentials: "include" });
    heldBills = heldBills.filter(b => b.id !== bill.id);
    showHeld = false;
  }

  async function deleteHeld(id: string) {
    await fetch(`${API}/api/retail/held/${id}`, { method: "DELETE", credentials: "include" });
    heldBills = heldBills.filter(b => b.id !== id);
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<div class="pos">
  <div class="pos-grid">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h1 style="font-size: 22px;">รายการสินค้า</h1>
      <button class="btn ghost" onclick={() => (showHeld = !showHeld)}>
        บิลที่พักไว้ ({heldBills.length})
      </button>
    </div>

    {#if showHeld && heldBills.length > 0}
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin-bottom: 12px; font-size: 14px;">บิลที่พักไว้</h3>
        {#each heldBills as bill}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-radius: 6px; background: var(--surface-2); margin-bottom: 4px;">
            <div>
              <strong>{bill.label || "ไม่ระบุ"}</strong>
              <span style="color: var(--muted); margin-left: 8px;">{bill.cart.length} รายการ</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn ghost" style="padding: 4px 12px; font-size: 13px;" onclick={() => resumeBill(bill)}>เรียกคืน</button>
              <button class="btn ghost" style="padding: 4px 12px; font-size: 13px; color: var(--error);" onclick={() => deleteHeld(bill.id)}>✕</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if loading}
      <p>กำลังโหลด…</p>
    {:else if err}
      <p style="color: var(--error)">{err}</p>
    {:else if products.length === 0}
      <p style="color: var(--muted)">ยังไม่มีสินค้า — ไปเพิ่มที่หน้า <a href="/products" style="color: var(--accent)">สินค้า</a></p>
    {:else}
      <div class="product-grid">
        {#each products as p}
          {@const v = p.variants?.[0]}
          {#if v}
            <button class="product-card" onclick={() => addToCart(p, 0)}>
              <div>{p.name}</div>
              {#if v.name}<div style="font-size: 12px; color: var(--muted);">{v.name}</div>{/if}
              <div class="price">฿{fmt(v.priceSatang)}</div>
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    {#if lastInvoice}
      <div style="margin-top: 24px; padding: 16px; background: var(--accent-soft); border-radius: 10px;">
        ✓ ออกใบกำกับภาษีเลขที่ <strong>{lastInvoice}</strong> เรียบร้อย
      </div>
    {/if}
  </div>

  <aside class="pos-cart">
    <div class="cart-head">ตะกร้า ({totals.count} ชิ้น)</div>
    <div class="cart-list">
      {#each $cart as line (line.variantId)}
        <div class="cart-row">
          <div>
            <div>{line.productName}</div>
            {#if line.variantName}<div style="font-size: 11px; color: var(--muted);">{line.variantName}</div>{/if}
          </div>
          <div class="qty">
            <button onclick={() => setQty(line.variantId, line.qty - 1)} aria-label="−">−</button>
            <span style="min-width: 1.5em; text-align: center;">{line.qty}</span>
            <button onclick={() => setQty(line.variantId, line.qty + 1)} aria-label="+">+</button>
          </div>
          <div class="line-total">฿{fmt(line.qty * line.unitPriceSatang)}</div>
        </div>
      {/each}
      {#if $cart.length === 0}
        <p style="padding: 24px; text-align: center; color: var(--muted);">ตะกร้าว่าง</p>
      {/if}
    </div>

    {#if $cart.length > 0}
      <div style="padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border); background: var(--surface-2);">
        {#if discountSatang === 0}
          <div style="display: flex; gap: 8px;">
            <input
              placeholder="โค้ดส่วนลด"
              bind:value={discountCode}
              style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 6px; text-transform: uppercase;"
            />
            <button class="btn ghost" onclick={applyDiscount} disabled={applyingDiscount || !discountCode}>ใช้</button>
          </div>
        {:else}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--accent-soft); border-radius: 6px; color: var(--accent); font-size: 13px;">
            <span>✓ {discountName} (−฿{fmt(discountSatang)})</span>
            <button class="btn ghost" style="padding: 0 4px; color: var(--accent);" onclick={clearDiscount}>✕</button>
          </div>
        {/if}
      </div>
    {/if}

    <div class="cart-totals">
      <div class="totals-row"><span>ยอดก่อน VAT</span><span>฿{fmt(totals.subtotalSatang)}</span></div>
      <div class="totals-row"><span>VAT 7%</span><span>฿{fmt(totals.vatSatang)}</span></div>
      {#if discountSatang > 0}
        <div class="totals-row" style="color: var(--accent);"><span>ส่วนลด</span><span>−฿{fmt(discountSatang)}</span></div>
      {/if}
      <div class="totals-row grand"><span>รวม</span><span>฿{fmt(totals.totalSatang)}</span></div>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn ghost" style="flex: 1;" onclick={holdBill} disabled={$cart.length === 0}>พักบิล</button>
        <button class="btn primary" style="flex: 2;" onclick={openPayment} disabled={$cart.length === 0}>รับเงิน</button>
      </div>
    </div>
  </aside>
</div>

{#if payOpen}
  <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 100;">
    <div style="background: var(--surface); border-radius: 10px; padding: 24px; width: min(520px, 95vw); max-height: 90vh; overflow-y: auto;">
      <h2 style="font-size: 17px; margin-bottom: 16px;">รับเงิน — ยอด ฿{fmt(totals.totalSatang)}</h2>

      {#each payments as p, i}
        <div style="display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end;">
          <label>
            {#if i === 0}<span style="display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">วิธีชำระ</span>{/if}
            <select bind:value={p.method} style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px;">
              <option value="cash">เงินสด</option>
              <option value="promptpay">PromptPay</option>
              <option value="card">บัตร</option>
              <option value="wallet">บัตรเงินสด/wallet</option>
            </select>
          </label>
          <label>
            {#if i === 0}<span style="display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">จำนวน (฿)</span>{/if}
            <input type="number" step="0.01" bind:value={p.amountBaht} style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-variant-numeric: tabular-nums;" />
          </label>
          <button class="btn ghost" style="padding: 10px; color: var(--error);" onclick={() => removePaymentRow(i)} disabled={payments.length === 1}>✕</button>
        </div>
      {/each}

      <button class="btn ghost" style="margin-top: 4px; font-size: 13px;" onclick={addPaymentRow}>+ จ่ายแบบผสม</button>

      <div style="margin-top: 16px; padding: 12px; background: var(--surface-2); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span>รับมา</span>
          <strong style="font-variant-numeric: tabular-nums;">฿{fmt(totalPaid)}</strong>
        </div>
        {#if change >= 0 && totalPaid >= totals.totalSatang}
          <div style="display: flex; justify-content: space-between; color: var(--success);">
            <span>ทอน</span>
            <strong style="font-variant-numeric: tabular-nums;">฿{fmt(change)}</strong>
          </div>
        {:else}
          <div style="display: flex; justify-content: space-between; color: var(--warning);">
            <span>ขาด</span>
            <strong style="font-variant-numeric: tabular-nums;">฿{fmt(totals.totalSatang - totalPaid)}</strong>
          </div>
        {/if}
      </div>

      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button class="btn ghost" style="flex: 1" onclick={() => (payOpen = false)}>ยกเลิก</button>
        <button class="btn primary" style="flex: 2" onclick={commitSale} disabled={totalPaid < totals.totalSatang}>ยืนยันการขาย</button>
      </div>
    </div>
  </div>
{/if}
