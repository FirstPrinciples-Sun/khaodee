<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let trialBalance = $state<any[]>([]);
  let pnl = $state<any | null>(null);
  let bs = $state<any | null>(null);
  let loading = $state(true);
  let err = $state("");

  const today = new Date();
  let year = $state(today.getFullYear());
  let month = $state(today.getMonth() + 1);

  async function load() {
    loading = true;
    try {
      const [tbR, plR, bsR] = await Promise.all([
        fetch(`${API}/api/reports/trial-balance?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/reports/pnl?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/reports/balance-sheet?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
      ]);
      trialBalance = tbR.rows ?? [];
      pnl = plR;
      bs = bsR;
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

  function downloadPp30() {
    const url = `${API}/api/reports/pp30.csv?shopId=${SHOP_ID}&year=${year}&month=${month}`;
    fetch(url, { credentials: "include" })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `pp30-${year}-${month}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      });
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">รายงานบัญชี</h1>

  {#if err}<p style="color: var(--error)">{err}</p>{/if}
  {#if loading}<p>กำลังโหลด…</p>{:else}

  <!-- Summary cards -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px;">
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px;">
      <div style="font-size: 13px; color: var(--muted);">รายได้</div>
      <div style="font-size: 28px; font-weight: 700; color: var(--success); font-variant-numeric: tabular-nums;">฿{fmt(pnl?.revenueSatang ?? 0)}</div>
    </div>
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px;">
      <div style="font-size: 13px; color: var(--muted);">ค่าใช้จ่าย</div>
      <div style="font-size: 28px; font-weight: 700; color: var(--error); font-variant-numeric: tabular-nums;">฿{fmt(pnl?.expenseSatang ?? 0)}</div>
    </div>
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px;">
      <div style="font-size: 13px; color: var(--muted);">กำไรสุทธิ</div>
      <div style="font-size: 28px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums;">฿{fmt(pnl?.netIncomeSatang ?? 0)}</div>
    </div>
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px;">
      <div style="font-size: 13px; color: var(--muted);">งบดุล {bs?.balanced ? "✓" : "⚠"}</div>
      <div style="font-size: 14px; color: var(--muted); margin-top: 4px;">
        Assets: ฿{fmt(bs?.assetsSatang ?? 0)}<br>
        Liab+Eq: ฿{fmt((bs?.liabilitiesSatang ?? 0) + (bs?.equitySatang ?? 0))}
      </div>
    </div>
  </div>

  <!-- ภพ.30 export -->
  <section style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 24px;">
    <h2 style="font-size: 17px; margin-bottom: 12px;">ภพ.30 — VAT รายเดือน</h2>
    <div style="display: flex; gap: 12px; align-items: end;">
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ปี</span>
        <input type="number" bind:value={year} style="width: 90px; padding: 8px; border: 1px solid var(--border); border-radius: 6px;" />
      </label>
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เดือน</span>
        <input type="number" bind:value={month} min="1" max="12" style="width: 70px; padding: 8px; border: 1px solid var(--border); border-radius: 6px;" />
      </label>
      <button class="btn primary" onclick={downloadPp30}>ดาวน์โหลด CSV</button>
    </div>
  </section>

  <!-- Trial Balance -->
  <section style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 24px;">
    <h2 style="font-size: 17px; margin-bottom: 12px;">งบทดลอง (Trial Balance)</h2>
    {#if trialBalance.length === 0}
      <p style="color: var(--muted)">ยังไม่มีรายการบัญชี — ทำการขายก่อนใน <a href="/cashier" style="color: var(--accent)">หน้า POS</a></p>
    {:else}
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: var(--surface-2);">
          <tr>
            <th style="padding: 10px; text-align: left;">รหัส</th>
            <th style="padding: 10px; text-align: left;">ชื่อบัญชี</th>
            <th style="padding: 10px; text-align: right;">เดบิต</th>
            <th style="padding: 10px; text-align: right;">เครดิต</th>
          </tr>
        </thead>
        <tbody>
          {#each trialBalance as row}
            <tr style="border-top: 1px solid var(--border);">
              <td style="padding: 10px; font-family: var(--font-mono); font-size: 13px;">{row.code}</td>
              <td style="padding: 10px;">{row.nameTh}</td>
              <td style="padding: 10px; text-align: right; font-variant-numeric: tabular-nums;">{row.debitSatang ? "฿" + fmt(row.debitSatang) : "—"}</td>
              <td style="padding: 10px; text-align: right; font-variant-numeric: tabular-nums;">{row.creditSatang ? "฿" + fmt(row.creditSatang) : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  {/if}
</main>
