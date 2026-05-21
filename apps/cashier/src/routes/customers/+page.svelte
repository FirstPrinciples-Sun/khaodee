<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let customers = $state<any[]>([]);
  let q = $state("");
  let loading = $state(true);
  let err = $state(""); let msg = $state(""); let saving = $state(false);

  let newName = $state(""); let newPhone = $state("");
  let newTin = $state(""); let newAddress = $state(""); let newConsent = $state(false);

  async function load() {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    const r = await fetch(`${API}/api/retail/customers?shopId=${SHOP_ID}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { credentials: "include" });
    const j = await r.json();
    customers = j.customers ?? [];
    loading = false;
  }

  onMount(load);

  async function add(e: Event) {
    e.preventDefault();
    err = ""; msg = ""; saving = true;
    try {
      const r = await fetch(`${API}/api/retail/customers`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID, name: newName, phone: newPhone || undefined,
          tin: newTin || undefined, address: newAddress || undefined,
          consentMarketing: newConsent,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      msg = `เพิ่มลูกค้า "${newName}" แล้ว`;
      newName = ""; newPhone = ""; newTin = ""; newAddress = ""; newConsent = false;
      await load();
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">ลูกค้า</h1>

  <form onsubmit={add} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px; display: grid; grid-template-columns: 2fr 1fr 1fr 2fr 1fr auto; gap: 12px; align-items: end;">
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ชื่อ *</span>
      <input bind:value={newName} required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เบอร์</span>
      <input bind:value={newPhone} type="tel" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">TIN (B2B)</span>
      <input bind:value={newTin} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <label>
      <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ที่อยู่</span>
      <input bind:value={newAddress} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
    </label>
    <label style="display:flex; align-items:center; gap:6px;">
      <input type="checkbox" bind:checked={newConsent} /> PDPA
    </label>
    <button class="btn primary" type="submit" disabled={saving}>เพิ่ม</button>
  </form>

  {#if msg}<div style="padding: 12px; background: var(--accent-soft); border-radius: 8px; margin-bottom: 16px;">{msg}</div>{/if}
  {#if err}<div style="padding: 12px; background: rgba(196,83,58,0.1); color: var(--error); border-radius: 8px; margin-bottom: 16px;">{err}</div>{/if}

  <div style="margin-bottom: 16px;">
    <input
      placeholder="ค้นหา ชื่อ / เบอร์"
      bind:value={q}
      oninput={() => { clearTimeout((window as any)._t); (window as any)._t = setTimeout(load, 300); }}
      style="width: 320px; padding: 10px; border: 1px solid var(--border); border-radius: 6px;"
    />
  </div>

  {#if loading}<p>กำลังโหลด…</p>{:else if customers.length === 0}
    <p style="color: var(--muted); padding: 32px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">ไม่มีลูกค้าตรงตัวกรอง</p>
  {:else}
    <table style="width:100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-collapse: collapse; overflow:hidden;">
      <thead style="background: var(--surface-2);">
        <tr>
          <th style="padding: 12px 16px; text-align: left;">ชื่อ</th>
          <th style="padding: 12px 16px; text-align: left;">เบอร์</th>
          <th style="padding: 12px 16px; text-align: left;">TIN</th>
          <th style="padding: 12px 16px; text-align: right;">แต้ม</th>
          <th style="padding: 12px 16px; text-align: center;">PDPA</th>
        </tr>
      </thead>
      <tbody>
        {#each customers as c}
          <tr style="border-top: 1px solid var(--border);">
            <td style="padding: 12px 16px;">{c.name}</td>
            <td style="padding: 12px 16px; color: var(--muted);">{c.phone ?? "—"}</td>
            <td style="padding: 12px 16px; font-family: var(--font-mono); font-size: 13px;">{c.tin ?? "—"}</td>
            <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">{c.loyaltyPoints}</td>
            <td style="padding: 12px 16px; text-align: center; color: {c.consentMarketing ? 'var(--success)' : 'var(--muted)'}">{c.consentMarketing ? "✓" : "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</main>
