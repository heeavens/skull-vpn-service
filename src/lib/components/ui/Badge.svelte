<script lang="ts">
  import type { Snippet } from 'svelte';

  type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

  interface Props {
    children: Snippet;
    tone?: BadgeTone;
    dot?: boolean;
    class?: string;
  }

  let { children, tone = 'neutral', dot = false, class: className = '' }: Props = $props();
</script>

<span class={`ui-badge ui-badge--${tone} ${className}`}>
  {#if dot}<span class="ui-badge__dot" aria-hidden="true"></span>{/if}
  {@render children()}
</span>
