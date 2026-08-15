<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { navigationItems, type SectionId } from './navigation';

  interface Props {
    activeSection: SectionId;
    onChange: (section: SectionId) => void;
  }

  let { activeSection, onChange }: Props = $props();
</script>

<nav class="glass-nav" aria-label="Основная навигация">
  {#each navigationItems as item (item.id)}
    {@const isActive = item.id === activeSection}
    <button
      type="button"
      class:active={isActive}
      aria-current={isActive ? 'page' : undefined}
      aria-controls={`section-${item.id}`}
      data-testid={`nav-${item.id}`}
      onclick={() => onChange(item.id)}
    >
      <Icon name={item.icon} size={22} />
      <span>{item.label}</span>
      <i aria-hidden="true"></i>
    </button>
  {/each}
</nav>
