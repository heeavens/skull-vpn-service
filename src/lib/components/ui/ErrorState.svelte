<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    title?: string;
    message: string;
    onRetry?: () => void;
  }

  let { title = 'Что-то пошло не так', message, onRetry }: Props = $props();
</script>

<div class="error-state" role="alert">
  <span class="error-state__icon"><Icon name="warning" size={28} /></span>
  <div>
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
  {#if onRetry}<Button variant="secondary" size="sm" onclick={onRetry}>Повторить</Button>{/if}
</div>
