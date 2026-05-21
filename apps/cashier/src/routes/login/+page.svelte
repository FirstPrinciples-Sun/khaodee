<script lang="ts">
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  let email = $state("");
  let password = $state("");
  let name = $state("Owner");
  let mode = $state<"login" | "register">("login");
  let err = $state("");
  let loading = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    err = "";
    loading = true;
    try {
      if (mode === "login") await api.login(email, password);
      else await api.register(email, password, name);
      // Bootstrap demo shop + terminal so the cashier UI works immediately.
      // Idempotent — no-ops if already created.
      try {
        await fetch("http://localhost:3000/api/shops", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "demo-shop",
            name: name || "ร้านสาธิต",
            tin: "0000000000000",
            address: "—",
            vatRegistered: true,
          }),
        });
        await fetch("http://localhost:3000/api/shops/terminals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "demo-terminal",
            shopId: "demo-shop",
            prefix: "T1",
            name: "Terminal 1",
          }),
        });
      } catch {}
      goto("/cashier");
    } catch (e: any) {
      err = e.message ?? "ผิดพลาด";
    } finally {
      loading = false;
    }
  }
</script>

<div class="login">
  <form class="login-card" onsubmit={submit}>
    <h1>Khaodee — เข้าสู่ระบบ</h1>

    {#if mode === "register"}
      <label>
        <span>ชื่อ</span>
        <input bind:value={name} required minlength="1" />
      </label>
    {/if}
    <label>
      <span>อีเมล</span>
      <input type="email" bind:value={email} required autocomplete="email" />
    </label>
    <label>
      <span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
      <input type="password" bind:value={password} required minlength="8" autocomplete="current-password" />
    </label>

    {#if err}<div class="err">{err}</div>{/if}

    <div style="display: flex; gap: 8px; margin-top: 16px;">
      <button class="btn primary" type="submit" disabled={loading} style="flex: 1">
        {loading ? "กำลังโหลด…" : mode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
      </button>
    </div>

    <div style="margin-top: 16px; text-align: center;">
      <button
        type="button"
        class="btn ghost"
        style="font-size: 13px; padding: 4px 8px;"
        onclick={() => (mode = mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "ยังไม่มีบัญชี? ลงทะเบียน" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
      </button>
    </div>
  </form>
</div>
