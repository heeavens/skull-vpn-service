<script lang="ts">
  import Icon from './Icon.svelte';
  import type { FAQItem } from './faq.types';

  interface Props {
    items: readonly FAQItem[];
    openFirst?: boolean;
  }

  let { items, openFirst = false }: Props = $props();
</script>

<div class="faq-list">
  {#each items as item, index (item.id)}
    <details class="faq-item" open={openFirst && index === 0}>
      <summary>
        <span>{item.question}</span>
        <Icon name="chevron-right" size={23} class="faq-item__chevron" />
      </summary>
      <p>{item.answer}</p>
    </details>
  {/each}
</div>
