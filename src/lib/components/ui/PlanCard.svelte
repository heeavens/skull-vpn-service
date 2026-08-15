<script lang="ts">
  import Badge from './Badge.svelte';
  import Button from './Button.svelte';

  interface Props {
    name: string;
    description?: string;
    days: number;
    amountMinor: number;
    currency: string;
    selected?: boolean;
    onSelect?: () => void;
  }

  let {
    name,
    description,
    days,
    amountMinor,
    currency,
    selected = false,
    onSelect
  }: Props = $props();

  const formattedPrice = $derived(
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amountMinor / 100)
  );
</script>

<article class:selected class="plan-card">
  <div class="plan-card__heading">
    <div>
      <span class="plan-card__duration">{days} дней</span>
      <h3>{name}</h3>
    </div>
    {#if selected}<Badge tone="info"><span>Выбран</span></Badge>{/if}
  </div>
  {#if description}<p>{description}</p>{/if}
  <strong class="plan-card__price">{formattedPrice}</strong>
  {#if onSelect}
    <Button variant={selected ? 'secondary' : 'primary'} onclick={onSelect} aria-pressed={selected}>
      {selected ? 'Выбрано' : 'Выбрать'}
    </Button>
  {/if}
</article>
