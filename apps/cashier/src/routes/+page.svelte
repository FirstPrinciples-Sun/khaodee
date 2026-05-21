<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  onMount(() => goto("/cashier"));
</script>

<p style="padding: 2rem">Loading…</p>
