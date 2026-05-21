<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let entries = $state<any[]>([]);
  let loading = $state(true);
  let err = $state("");

  onMount(async () => {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    try {
      const r = await fetch(`${API}/api/reports/journal?shopId=${SHOP_ID}&limit=100`, { credentials: "include" });
      const j = await r.json();
      entries = j.entries ?? [];
    } catch (e: any) {
      err = e.message;
    } finally {
      loading = false;
    }
  });

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(ts: any) {
    return new Date(ts).toLocaleString("th-TH");
  }
</script>

<main style="max-width: 1000px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">บัญชีรายวัน (Journal)</h1>

  {#if err}<p style="color: var(--error)">{err}</p>{/if}
  {#if loading}
    <p>กำลังโหลด…</p>
  {:else if entries.length === 0}
    <p style="color: var(--muted); padding: 48px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">
      ยังไม่มี journal entry — ทำการขายใน <a href="/cashier" style="color: var(--accent)">หน้า POS</a>
    </p>
  {:else}
    {#each entries as e}
      <article style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 12px;">
        <header style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong>{e.sourceType.toUpperCase()}</strong>
          <span style="color: var(--muted); font-size: 13px;">{fmtDate(e.postedAt)}</span>
        </header>
        {#if e.memo}<div style="color: var(--muted); font-size: 13px; margin-bottom: 8px;">{e.memo}</div>{/if}
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="color: var(--muted); font-size: 12px;">
              <th style="padding: 4px 8px; text-align: left;">รหัส</th>
              <th style="padding: 4px 8px; text-align: right;">เดบิต</th>
              <th style="padding: 4px 8px; text-align: right;">เครดิต</th>
            </tr>
          </thead>
          <tbody>
            {#each e.lines as l}
              <tr>
                <td style="padding: 4px 8px; font-family: var(--font-mono);">{l.accountCode}</td>
                <td style="padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums;">{l.debitSatang ? "฿" + fmt(l.debitSatang) : ""}</td>
                <td style="padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums;">{l.creditSatang ? "฿" + fmt(l.creditSatang) : ""}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </article>
    {/each}
  {/if}
</main>
