<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, cart, cartTotals, addToCart, setQty, clearCart, type Product } from "$lib/api";

  const SHOP_ID = "demo-shop";

  let products = $state<Product[]>([]);
  let loading = $state(true);
  let err = $state("");
  let payOpen = $state(false);
  let received = $state(0);
  let lastInvoice = $state<string | null>(null);

  onMount(async () => {
    const u = await api.me();
    if (!u) {
      goto("/login");
      return;
    }
    try {
      products = await api.products(SHOP_ID);
    } catch (e: any) {
      err = e.message;
    } finally {
      loading = false;
    }
  });

  async function commitCash() {
    const lines = $cart.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      unitPriceSatang: l.unitPriceSatang,
      taxCode: "VAT7" as const,
    }));
    const totals = $cartTotals;
    try {
      const result = await api.commitTx({
        shopId: SHOP_ID,
        terminalId: "demo-terminal",
        lines,
        payments: [{ method: "cash", amountSatang: totals.totalSatang }],
        invoiceType: "abbreviated",
      });
      lastInvoice = result.invoiceNumber;
      clearCart();
      payOpen = false;
      received = 0;
    } catch (e: any) {
      err = e.message;
    }
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<div class="pos">
  <div class="pos-grid">
    <h1 style="margin-bottom: 16px; font-size: 22px;">รายการสินค้า</h1>
    {#if loading}
      <p>กำลังโหลด…</p>
    {:else if err}
      <p style="color: var(--error)">{err}</p>
    {:else if products.length === 0}
      <p style="color: var(--muted)">ยังไม่มีสินค้า — สร้างผ่าน admin หรือ POST /api/products</p>
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
    <div class="cart-head">ตะกร้า ({$cartTotals.count} ชิ้น)</div>
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

    <div class="cart-totals">
      <div class="totals-row"><span>ยอดก่อน VAT</span><span>฿{fmt($cartTotals.subtotalSatang)}</span></div>
      <div class="totals-row"><span>VAT 7%</span><span>฿{fmt($cartTotals.vatSatang)}</span></div>
      <div class="totals-row grand"><span>รวม</span><span>฿{fmt($cartTotals.totalSatang)}</span></div>

      <button
        class="btn primary"
        style="width: 100%; margin-top: 12px;"
        onclick={() => (payOpen = true)}
        disabled={$cart.length === 0}
      >
        รับเงิน
      </button>
    </div>
  </aside>
</div>

{#if payOpen}
  <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 100;">
    <div style="background: var(--surface); border-radius: 10px; padding: 24px; width: min(420px, 90vw);">
      <h2 style="font-size: 17px; margin-bottom: 16px;">รับเงินสด</h2>
      <p style="color: var(--muted); margin-bottom: 8px;">ยอดรวม: <strong style="color: var(--text); font-size: 22px;">฿{fmt($cartTotals.totalSatang)}</strong></p>
      <label>
        <span style="display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">รับเงินมา (บาท)</span>
        <input
          type="number"
          bind:value={received}
          step="0.01"
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 22px; font-variant-numeric: tabular-nums;"
        />
      </label>
      {#if received * 100 >= $cartTotals.totalSatang}
        <p style="margin-top: 8px;">เงินทอน: <strong>฿{fmt(received * 100 - $cartTotals.totalSatang)}</strong></p>
      {/if}

      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button class="btn ghost" style="flex: 1" onclick={() => (payOpen = false)}>ยกเลิก</button>
        <button class="btn primary" style="flex: 1" onclick={commitCash} disabled={received * 100 < $cartTotals.totalSatang}>
          ยืนยัน
        </button>
      </div>
    </div>
  </div>
{/if}
