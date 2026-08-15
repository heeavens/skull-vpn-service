<script lang="ts">
  import type { Snippet } from 'svelte';

  type CardVariant = 'sketch' | 'soft' | 'plain';
  type CardPadding = 'none' | 'sm' | 'md' | 'lg';

  interface Props {
    children: Snippet;
    variant?: CardVariant;
    padding?: CardPadding;
    class?: string;
  }

  let { children, variant = 'sketch', padding = 'md', class: className = '' }: Props = $props();
</script>

<div class={`ui-card ui-card--${variant} ui-card--padding-${padding} ${className}`}>
  {@render children()}
</div>
