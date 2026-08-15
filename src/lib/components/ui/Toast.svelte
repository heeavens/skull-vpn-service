<script lang="ts">
  import Icon from './Icon.svelte';

  type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

  interface Props {
    message: string;
    visible?: boolean;
    tone?: ToastTone;
  }

  let { message, visible = false, tone = 'neutral' }: Props = $props();
</script>

<div
  class:ui-toast--visible={visible}
  class={`ui-toast ui-toast--${tone}`}
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-hidden={!visible}
>
  {#if visible}
    {#if tone === 'success'}
      <Icon name="check" size={18} />
    {:else if tone === 'warning' || tone === 'danger'}
      <Icon name="warning" size={18} />
    {:else}
      <Icon name="info" size={18} />
    {/if}
    <span>{message}</span>
  {/if}
</div>
