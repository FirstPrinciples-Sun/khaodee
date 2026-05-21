<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, type Product } from "$lib/api";

  const SHOP_ID = "demo-shop";
  let products = $state<Product[]>([]);
  let loading = $state(true);
  let err = $state("");

  let newName = $state("");
  let newSku = $state("");
  let newPriceBaht = $state(0);
  let newCostBaht = $state(0);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      products = await api.products(SHOP_ID);
    } catch (e: any) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    await load();
  });

  async function add(e: Event) {
    e.preventDefault();
    err = "";
    saving = true;
    try {
      const res = await fetch("http://localhost:3000/api/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID,
          name: newName,
          variants: [{
            sku: newSku || `${newName.toUpperCase().replace(/\s+/g, "-").slice(0, 12)}-${Date.now().toString(36)}`,
            priceSatang: Math.round(newPriceBaht * 100),
            costSatang: Math.round(newCostBaht * 100),
          }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      newName = ""; newSku = ""; newPriceBaht = 0; newCostBaht = 0;
      await load();
    } catch (e: any) {
      err = e.message;
    } finally {
      saving = false;
    }
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<main style="max-width: 900px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">จัดการสินค้า</h1>

  <form onsubmit={add} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ชื่อสินค้า *</span>
      <input bind:value={newName} required minlength="1" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" placeholder="เช่น ชาเย็น" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">SKU</span>
      <input bind:value={newSku} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" placeholder="auto" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ราคา (บาท) *</span>
      <input type="number" step="0.01" bind:value={newPriceBaht} required min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ต้นทุน (บาท)</span>
      <input type="number" step="0.01" bind:value={newCostBaht} min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <button class="btn primary" type="submit" disabled={saving}>{saving ? "..." : "เพิ่ม"}</button>
  </form>

  {#if err}<p style="color: var(--error)">{err}</p>{/if}

  {#if loading}
    <p>กำลังโหลด…</p>
  {:else if products.length === 0}
    <p style="color: var(--muted); padding: 48px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">
      ยังไม่มีสินค้า — เพิ่มจากแบบฟอร์มด้านบน
    </p>
  {:else}
    <table style="width:100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-collapse: collapse; overflow: hidden;">
      <thead style="background: var(--surface-2);">
        <tr>
          <th style="padding: 12px 16px; text-align: left;">ชื่อ</th>
          <th style="padding: 12px 16px; text-align: left;">SKU</th>
          <th style="padding: 12px 16px; text-align: right;">ราคา</th>
          <th style="padding: 12px 16px; text-align: right;">ต้นทุน</th>
        </tr>
      </thead>
      <tbody>
        {#each products as p}
          {#each p.variants as v}
            <tr style="border-top: 1px solid var(--border);">
              <td style="padding: 12px 16px;">{p.name}{v.name ? ` — ${v.name}` : ""}</td>
              <td style="padding: 12px 16px; font-family: var(--font-mono); font-size: 13px; color: var(--muted);">{v.sku}</td>
              <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">฿{fmt(v.priceSatang)}</td>
              <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted);">฿{fmt((v as any).costSatang ?? 0)}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  {/if}
</main>
