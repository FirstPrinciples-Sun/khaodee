<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import "$lib/app.css";
  import { api } from "$lib/api";

  let { children } = $props();

  async function logout() {
    await api.logout();
    goto("/login");
  }
</script>

{#if $page.url.pathname !== "/login" && $page.url.pathname !== "/"}
  <nav class="nav">
    <a class="brand" href="/cashier">Khaodee</a>
    <a class:active={$page.url.pathname === "/cashier"} href="/cashier">ขาย</a>
    <a class:active={$page.url.pathname === "/products"} href="/products">สินค้า</a>
    <a class:active={$page.url.pathname === "/warehouse"} href="/warehouse">คลัง</a>
    <a class:active={$page.url.pathname.startsWith("/hr")} href="/hr">พนักงาน</a>
    <a class:active={$page.url.pathname === "/customers"} href="/customers">ลูกค้า</a>
    <a class:active={$page.url.pathname === "/promo"} href="/promo">โปรโมชั่น</a>
    <a class:active={$page.url.pathname === "/reports"} href="/reports">รายงาน</a>
    <a class:active={$page.url.pathname === "/journal"} href="/journal">บัญชี</a>
    <span style="flex: 1"></span>
    <button class="btn ghost" onclick={logout}>ออกจากระบบ</button>
  </nav>
{/if}

{@render children()}
