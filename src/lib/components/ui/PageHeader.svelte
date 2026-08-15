<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    subtitle?: string;
    action?: Snippet;
    id?: string;
  }

  let { title, subtitle, action, id }: Props = $props();
</script>

<header class="page-header">
  <div class="page-header__copy">
    <h1 {id} tabindex="-1">{title}</h1>
    {#if subtitle}<p>{subtitle}</p>{/if}
  </div>
  {#if action}<div class="page-header__action">{@render action()}</div>{/if}
</header>
