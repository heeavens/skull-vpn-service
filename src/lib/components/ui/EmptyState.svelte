<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icon.types';

  interface Props {
    title: string;
    description: string;
    icon?: IconName;
    action?: Snippet;
  }

  let { title, description, icon = 'sparkles', action }: Props = $props();
</script>

<div class="empty-state">
  <span class="empty-state__icon"><Icon name={icon} size={28} /></span>
  <h3>{title}</h3>
  <p>{description}</p>
  {#if action}<div class="empty-state__action">{@render action()}</div>{/if}
</div>
