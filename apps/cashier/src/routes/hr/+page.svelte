<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  const SHOP_ID = "demo-shop";
  const API = "http://localhost:3000";

  let tab = $state<"employees" | "payroll">("employees");

  let employees = $state<any[]>([]);
  let runs = $state<any[]>([]);
  let selectedRun = $state<any | null>(null);
  let runLines = $state<any[]>([]);

  let msg = $state(""); let err = $state(""); let saving = $state(false);

  // Add employee form
  let newName = $state("");
  let newCitizenId = $state("");
  let newPosition = $state("");
  let newBaseBaht = $state(15000);
  let newRole = $state<"owner" | "manager" | "cashier" | "accountant">("cashier");
  let newSso = $state(true);

  // Run payroll form
  const today = new Date();
  let runYear = $state(today.getFullYear());
  let runMonth = $state(today.getMonth() + 1);
  let runLinesInput = $state<Record<string, { otHours: number; otRateBaht: number; bonusBaht: number; otherEarningsBaht: number; otherDeductBaht: number }>>({});

  async function load() {
    const u = await api.me();
    if (!u) { goto("/login"); return; }
    const [er, rr] = await Promise.all([
      fetch(`${API}/api/hr/employees?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/hr/payroll?shopId=${SHOP_ID}`, { credentials: "include" }).then(r => r.json()),
    ]);
    employees = er.employees ?? [];
    runs = rr.runs ?? [];
    // Init run line input for each employee
    for (const e of employees) {
      if (!runLinesInput[e.id]) runLinesInput[e.id] = { otHours: 0, otRateBaht: 0, bonusBaht: 0, otherEarningsBaht: 0, otherDeductBaht: 0 };
    }
  }

  onMount(load);

  async function addEmployee(e: Event) {
    e.preventDefault();
    err = ""; msg = ""; saving = true;
    try {
      const r = await fetch(`${API}/api/hr/employees`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: SHOP_ID, name: newName, citizenId: newCitizenId || undefined,
          position: newPosition || undefined, baseSalaryBaht: newBaseBaht,
          role: newRole, ssoEnrolled: newSso,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      msg = `เพิ่มพนักงาน "${newName}" แล้ว`;
      newName = ""; newCitizenId = ""; newPosition = ""; newBaseBaht = 15000;
      await load();
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }

  async function runPayroll() {
    err = ""; msg = ""; saving = true;
    try {
      const lines = employees.map((e) => ({
        employeeId: e.id,
        ...runLinesInput[e.id],
      }));
      const r = await fetch(`${API}/api/hr/payroll/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: SHOP_ID, year: runYear, month: runMonth, lines }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      const j = await r.json();
      msg = `สร้าง payroll run ${runYear}/${runMonth} เรียบร้อย`;
      await load();
      await viewRun(j.id);
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }

  async function viewRun(runId: string) {
    const r = await fetch(`${API}/api/hr/payroll/${runId}`, { credentials: "include" });
    const j = await r.json();
    selectedRun = j.run;
    runLines = j.lines;
  }

  async function postRun() {
    if (!selectedRun) return;
    err = ""; msg = ""; saving = true;
    try {
      const r = await fetch(`${API}/api/hr/payroll/${selectedRun.id}/post`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      msg = "บันทึก journal entry ของ payroll เรียบร้อย — ดูใน 'บัญชี'";
      await load();
      await viewRun(selectedRun.id);
    } catch (e: any) { err = e.message; } finally { saving = false; }
  }

  function fmt(satang: number) {
    return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<main style="max-width: 1200px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 16px;">พนักงาน + เงินเดือน</h1>

  <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border);">
    <button class="btn ghost" style:background={tab === "employees" ? "var(--accent-soft)" : ""} onclick={() => (tab = "employees")}>พนักงาน ({employees.length})</button>
    <button class="btn ghost" style:background={tab === "payroll" ? "var(--accent-soft)" : ""} onclick={() => (tab = "payroll")}>จ่ายเงินเดือน ({runs.length})</button>
  </div>

  {#if msg}<div style="padding: 12px; background: var(--accent-soft); border-radius: 8px; margin-bottom: 16px;">{msg}</div>{/if}
  {#if err}<div style="padding: 12px; background: rgba(196,83,58,0.1); color: var(--error); border-radius: 8px; margin-bottom: 16px;">{err}</div>{/if}

  {#if tab === "employees"}
    <form onsubmit={addEmployee} style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px; display: grid; grid-template-columns: 2fr 2fr 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ชื่อ *</span>
        <input bind:value={newName} required style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
      </label>
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เลขประจำตัว 13 หลัก</span>
        <input bind:value={newCitizenId} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
      </label>
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ตำแหน่ง</span>
        <input bind:value={newPosition} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
      </label>
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เงินเดือน (฿)</span>
        <input type="number" bind:value={newBaseBaht} min="0" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;" />
      </label>
      <label>
        <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">บทบาท</span>
        <select bind:value={newRole} style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px;">
          <option value="owner">เจ้าของ</option>
          <option value="manager">ผู้จัดการ</option>
          <option value="cashier">แคชเชียร์</option>
          <option value="accountant">บัญชี</option>
        </select>
      </label>
      <label style="display:flex; align-items:center; gap: 6px;">
        <input type="checkbox" bind:checked={newSso} /> SSO
      </label>
      <button class="btn primary" type="submit" disabled={saving}>{saving ? "..." : "เพิ่ม"}</button>
    </form>

    {#if employees.length === 0}
      <p style="color: var(--muted); padding: 32px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">
        ยังไม่มีพนักงาน
      </p>
    {:else}
      <table style="width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-collapse: collapse; overflow: hidden;">
        <thead style="background: var(--surface-2);">
          <tr>
            <th style="padding: 12px 16px; text-align: left;">ชื่อ</th>
            <th style="padding: 12px 16px; text-align: left;">ตำแหน่ง</th>
            <th style="padding: 12px 16px; text-align: left;">บทบาท</th>
            <th style="padding: 12px 16px; text-align: right;">เงินเดือน</th>
            <th style="padding: 12px 16px; text-align: center;">SSO</th>
          </tr>
        </thead>
        <tbody>
          {#each employees as e}
            <tr style="border-top: 1px solid var(--border);">
              <td style="padding: 12px 16px;">{e.name}</td>
              <td style="padding: 12px 16px; color: var(--muted);">{e.position ?? "—"}</td>
              <td style="padding: 12px 16px;">{e.role}</td>
              <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">฿{fmt(e.baseSalarySatang)}</td>
              <td style="padding: 12px 16px; text-align: center;">{e.ssoEnrolled ? "✓" : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}

  {#if tab === "payroll"}
    <section style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 24px;">
      <h3 style="margin-bottom: 16px;">สร้าง payroll รายเดือน</h3>
      <div style="display:flex; gap: 12px; align-items: end; margin-bottom: 16px;">
        <label>
          <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">ปี</span>
          <input type="number" bind:value={runYear} style="width:90px; padding:8px; border:1px solid var(--border); border-radius:6px;" />
        </label>
        <label>
          <span style="display:block; font-size: 13px; color: var(--muted); margin-bottom: 4px;">เดือน</span>
          <input type="number" bind:value={runMonth} min="1" max="12" style="width:70px; padding:8px; border:1px solid var(--border); border-radius:6px;" />
        </label>
        <button class="btn primary" onclick={runPayroll} disabled={saving || employees.length === 0}>คำนวณและสร้าง</button>
      </div>

      {#if employees.length > 0}
        <table style="width:100%; border-collapse: collapse; font-size: 13px;">
          <thead style="background: var(--surface-2);">
            <tr>
              <th style="padding: 8px; text-align: left;">พนักงาน</th>
              <th style="padding: 8px;">OT (ชม.)</th>
              <th style="padding: 8px;">เรท OT (฿/ชม.)</th>
              <th style="padding: 8px;">โบนัส (฿)</th>
              <th style="padding: 8px;">รายได้อื่น (฿)</th>
              <th style="padding: 8px;">หักอื่น (฿)</th>
            </tr>
          </thead>
          <tbody>
            {#each employees as e}
              <tr style="border-top: 1px solid var(--border);">
                <td style="padding: 8px;">{e.name}</td>
                <td style="padding: 8px;"><input type="number" step="0.5" min="0" bind:value={runLinesInput[e.id].otHours} style="width:80px; padding:4px; border:1px solid var(--border); border-radius:4px;" /></td>
                <td style="padding: 8px;"><input type="number" min="0" bind:value={runLinesInput[e.id].otRateBaht} style="width:80px; padding:4px; border:1px solid var(--border); border-radius:4px;" /></td>
                <td style="padding: 8px;"><input type="number" min="0" bind:value={runLinesInput[e.id].bonusBaht} style="width:90px; padding:4px; border:1px solid var(--border); border-radius:4px;" /></td>
                <td style="padding: 8px;"><input type="number" min="0" bind:value={runLinesInput[e.id].otherEarningsBaht} style="width:90px; padding:4px; border:1px solid var(--border); border-radius:4px;" /></td>
                <td style="padding: 8px;"><input type="number" min="0" bind:value={runLinesInput[e.id].otherDeductBaht} style="width:90px; padding:4px; border:1px solid var(--border); border-radius:4px;" /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section style="display: grid; grid-template-columns: 280px 1fr; gap: 16px;">
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px;">
        <h4 style="margin-bottom: 12px;">รายการ payroll</h4>
        {#each runs as r}
          <button
            onclick={() => viewRun(r.id)}
            style="display:block; width: 100%; text-align: left; padding: 8px; border-radius: 6px; margin-bottom: 4px; background: {selectedRun?.id === r.id ? 'var(--accent-soft)' : 'transparent'};"
          >
            {r.periodYear}/{String(r.periodMonth).padStart(2, '0')}
            <span style="float: right; font-size: 11px; padding: 2px 6px; border-radius: 999px; background: {r.status === 'posted' ? 'var(--success)' : 'var(--warning)'}; color: white;">{r.status}</span>
          </button>
        {/each}
      </div>

      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px;">
        {#if !selectedRun}
          <p style="color: var(--muted); padding: 32px; text-align: center;">เลือก run จากด้านซ้าย</p>
        {:else}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4>Payroll {selectedRun.periodYear}/{String(selectedRun.periodMonth).padStart(2, '0')}</h4>
            {#if selectedRun.status === "draft"}
              <button class="btn primary" onclick={postRun} disabled={saving}>โพสต์เข้าบัญชี</button>
            {:else}
              <span style="color: var(--success)">✓ posted</span>
            {/if}
          </div>
          <table style="width:100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: var(--surface-2);">
                <th style="padding: 6px; text-align: left;">ชื่อ</th>
                <th style="padding: 6px; text-align: right;">เงินเดือน</th>
                <th style="padding: 6px; text-align: right;">OT</th>
                <th style="padding: 6px; text-align: right;">โบนัส</th>
                <th style="padding: 6px; text-align: right;">รวม</th>
                <th style="padding: 6px; text-align: right;">SSO</th>
                <th style="padding: 6px; text-align: right;">WHT</th>
                <th style="padding: 6px; text-align: right;">รับสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {#each runLines as l}
                <tr style="border-top: 1px solid var(--border);">
                  <td style="padding: 6px;">{l.employeeName}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums;">{fmt(l.baseSalarySatang)}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums;">{fmt(Math.round(l.otHours * l.otRateSatang))}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums;">{fmt(l.bonusSatang)}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600;">{fmt(l.grossSatang)}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted);">{fmt(l.ssoEmployeeSatang)}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted);">{fmt(l.whtSatang)}</td>
                  <td style="padding: 6px; text-align: right; font-variant-numeric: tabular-nums; color: var(--accent); font-weight: 600;">{fmt(l.netSatang)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </section>
  {/if}
</main>
