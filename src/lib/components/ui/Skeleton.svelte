<script lang="ts">
  interface Props {
    lines?: number;
    label?: string;
  }

  let { lines = 3, label = 'Загрузка' }: Props = $props();
</script>

<div class="ui-skeleton" role="status" aria-label={label}>
  <span class="ui-skeleton__title"></span>
  {#each Array.from({ length: lines }, (_, index) => index) as index (index)}
    <span class:ui-skeleton__line--short={index === lines - 1} class="ui-skeleton__line"></span>
  {/each}
</div>
