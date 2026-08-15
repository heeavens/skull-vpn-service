<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    open?: boolean;
    title: string;
    children: Snippet;
    footer?: Snippet;
    closeLabel?: string;
    onClose?: () => void;
  }

  const componentId = $props.id();
  const titleId = `${componentId}-title`;
  let {
    open = $bindable(false),
    title,
    children,
    footer,
    closeLabel = 'Закрыть',
    onClose
  }: Props = $props();
  let dialog: HTMLDialogElement;

  function close(): void {
    open = false;
    onClose?.();
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === dialog) close();
  }

  $effect(() => {
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="ui-modal"
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclick={handleBackdropClick}
>
  <div class="ui-modal__surface">
    <header class="ui-modal__header">
      <h2 id={titleId}>{title}</h2>
      <Button variant="ghost" size="sm" aria-label={closeLabel} onclick={close}>
        <Icon name="close" size={21} />
      </Button>
    </header>
    <div class="ui-modal__content">{@render children()}</div>
    {#if footer}<footer class="ui-modal__footer">{@render footer()}</footer>{/if}
  </div>
</dialog>
