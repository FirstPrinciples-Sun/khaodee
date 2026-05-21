<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let tab = $state<"discounts" | "giftcards">("discounts");

  let discounts = $state<any[]>([]);
  let giftCards = $state<any[]>([]);
  let msg = $state(""); let err = $state(""); let saving = $state(false);

  // Add discount
  let dCode = $state(""); let dName = $state(""); let dType = $state<"percent" | "fixed">("percent");
  let dValue = $state(10); let dMinSubtotal = $state(0);

  // Issue gift card
  let gcCode = $state(""); let gcInitial = $state(500);

  async function load() {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    const [dr, gr] = await Promise.all([
      fetch(`${API}/api/retail/discounts?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/retail/giftcards?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
    ]);
    discounts = dr.discounts ?? [];
    giftCards = gr.giftCards ?? [];
  }

  onMount(load);

  async function addDiscount(e: Event) {
    e.preventDefault();
    err = ""; msg = ""; saving = true;
    try {
      const r = await fetch(`${API}/api/retail/discounts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID, code: dCode, name: dName,
          type: dType, value: dValue,
          minSubtotalBaht: dMinSubtotal,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      msg = `เพิ่มโค้ด "${dCode}" แล้ว`;
      dCode = ""; dName = ""; dValue = 10; dMinSubtotal = 0;
      await load();
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }

  async function issueGiftCard(e: Event) {
    e.preventDefault();
    err = ""; msg = ""; saving = true;
    try {
      const r = await fetch(`${API}/api/retail/giftcards`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: SHOP_ID, code: gcCode || undefined, initialBaht: gcInitial }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      const j = await r.json();
      msg = `ออกบัตรเลข "${j.code}" ยอด ฿${gcInitial.toLocaleString("th-TH")} แล้ว`;
      gcCode = ""; gcInitial = 500;
      await load();
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">โปรโมชั่น</h1>

  <div style="display:flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border);">
    <button class="btn ghost" style:background={tab === "discounts" ? "var(--accent-soft)" : ""} onclick={() => (tab = "discounts")}>ส่วนลด ({discounts.length})</button>
    <button class="btn ghost" style:background={tab === "giftcards" ? "var(--accent-soft)" : ""} onclick={() => (tab = "giftcards")}>บัตรเงินสด ({giftCards.length})</button>
  </div>

  {#if msg}<div style="padding: 12px; background: var(--accent-soft); border-radius: 8px; margin-bottom: 16px;">{msg}</div>{/if}
  {#if err}<div style="padding: 12px; background: rgba(196,83,58,0.1); color: var(--error); border-radius: 8px; margin-bottom: 16px;">{err}</div>{/if}

  {#if tab === "discounts"}
    <form onsubmit={addDiscount} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">โค้ด *</span><input bind:value={dCode} required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">ชื่อ *</span><input bind:value={dName} required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <label>
        <span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">ประเภท</span>
        <select bind:value={dType} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;">
          <option value="percent">% เปอร์เซ็นต์</option>
          <option value="fixed">฿ บาท</option>
        </select>
      </label>
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">ค่า</span><input type="number" bind:value={dValue} min="0" step="0.01" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">ขั้นต่ำ (฿)</span><input type="number" bind:value={dMinSubtotal} min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <button class="btn primary" type="submit" disabled={saving}>เพิ่ม</button>
    </form>

    {#if discounts.length === 0}
      <p style="color: var(--muted); padding: 32px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">ยังไม่มีส่วนลด</p>
    {:else}
      <table style="width:100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-collapse: collapse; overflow:hidden;">
        <thead style="background: var(--surface-2);">
          <tr><th style="padding:12px 16px; text-align:left;">โค้ด</th><th style="padding:12px 16px; text-align:left;">ชื่อ</th><th style="padding:12px 16px; text-align:right;">ส่วนลด</th><th style="padding:12px 16px; text-align:right;">ขั้นต่ำ</th></tr>
        </thead>
        <tbody>
          {#each discounts as d}
            <tr style="border-top: 1px solid var(--border);">
              <td style="padding:12px 16px; font-family: var(--font-mono); font-weight: 600;">{d.code}</td>
              <td style="padding:12px 16px;">{d.name}</td>
              <td style="padding:12px 16px; text-align:right; font-variant-numeric: tabular-nums;">{d.type === "percent" ? `${d.value}%` : `฿${d.value}`}</td>
              <td style="padding:12px 16px; text-align:right; color: var(--muted); font-variant-numeric: tabular-nums;">฿{fmt(d.minSubtotalSatang)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}

  {#if tab === "giftcards"}
    <form onsubmit={issueGiftCard} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px; display: grid; grid-template-columns: 2fr 1fr auto; gap: 12px; align-items: end;">
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">โค้ดบัตร (เว้นว่าง = สุ่ม)</span><input bind:value={gcCode} placeholder="auto" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <label><span style="display:block; font-size:13px; color: var(--muted); margin-bottom:4px;">ยอดเริ่มต้น (฿)</span><input type="number" bind:value={gcInitial} min="1" required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" /></label>
      <button class="btn primary" type="submit" disabled={saving}>ออกบัตร</button>
    </form>

    {#if giftCards.length === 0}
      <p style="color: var(--muted); padding: 32px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">ยังไม่มีบัตรเงินสด</p>
    {:else}
      <table style="width:100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-collapse: collapse; overflow:hidden;">
        <thead style="background: var(--surface-2);">
          <tr><th style="padding:12px 16px; text-align:left;">โค้ด</th><th style="padding:12px 16px; text-align:right;">เริ่มต้น</th><th style="padding:12px 16px; text-align:right;">คงเหลือ</th><th style="padding:12px 16px; text-align:left;">สถานะ</th></tr>
        </thead>
        <tbody>
          {#each giftCards as g}
            <tr style="border-top: 1px solid var(--border);">
              <td style="padding:12px 16px; font-family: var(--font-mono); font-weight: 600;">{g.code}</td>
              <td style="padding:12px 16px; text-align:right; font-variant-numeric: tabular-nums; color: var(--muted);">฿{fmt(g.initialSatang)}</td>
              <td style="padding:12px 16px; text-align:right; font-variant-numeric: tabular-nums; color: var(--accent); font-weight: 600;">฿{fmt(g.remainingSatang)}</td>
              <td style="padding:12px 16px;">
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: {g.status === 'active' ? 'var(--accent-soft)' : 'var(--surface-2)'}; color: {g.status === 'active' ? 'var(--accent)' : 'var(--muted)'};">{g.status}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</main>
