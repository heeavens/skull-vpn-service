<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type ButtonSize = 'sm' | 'md' | 'lg';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class'> & {
    children: Snippet;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    class?: string;
  };

  let {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    class: className = '',
    type = 'button',
    ...restProps
  }: Props = $props();
</script>

<button
  {...restProps}
  {type}
  class={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
  disabled={disabled || loading}
  aria-busy={loading}
>
  {#if loading}
    <span class="ui-spinner" aria-hidden="true"></span>
    <span class="sr-only">Загрузка</span>
  {/if}
  <span class:ui-button__content--loading={loading} class="ui-button__content">
    {@render children()}
  </span>
</button>
