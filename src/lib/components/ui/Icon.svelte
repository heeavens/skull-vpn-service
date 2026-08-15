<script lang="ts">
  import type { IconName } from './icon.types';

  interface Props {
    name: IconName;
    size?: number;
    label?: string;
    class?: string;
  }

  let { name, size = 24, label, class: className = '' }: Props = $props();
</script>

<svg
  class={`ui-icon ${className}`}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.9"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-hidden={label ? undefined : 'true'}
>
  {#if label}<title>{label}</title>{/if}
  {#if name === 'arrow-right'}
    <path d="M5 12h14M13 6l6 6-6 6" />
  {:else if name === 'bolt'}
    <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />
  {:else if name === 'check'}
    <path d="m5 12 4 4L19 6" />
  {:else if name === 'chevron-right'}
    <path d="m9 18 6-6-6-6" />
  {:else if name === 'close'}
    <path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'crown'}
    <path d="m4 8 4 4 4-7 4 7 4-4-2 11H6L4 8Z" />
  {:else if name === 'globe'}
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  {:else if name === 'help'}
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9a2.6 2.6 0 1 1 4.2 2.05c-.95.73-1.8 1.12-1.8 2.45M12 17h.01" />
  {:else if name === 'home'}
    <path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  {:else if name === 'lock'}
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  {:else if name === 'shield'}
    <path d="M12 3 5 6v5c0 4.9 2.9 8.1 7 10 4.1-1.9 7-5.1 7-10V6l-7-3Z" />
    <path d="m9.3 12 1.8 1.8 3.7-4" />
  {:else if name === 'sparkles'}
    <path
      d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"
    />
  {:else if name === 'user'}
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
  {:else if name === 'warning'}
    <path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  {/if}
</svg>
