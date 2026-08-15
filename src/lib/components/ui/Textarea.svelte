<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLTextareaAttributes,
    'value' | 'class' | 'id' | 'children' | 'aria-invalid' | 'aria-describedby'
  > & {
    value?: string;
    label: string;
    description?: string;
    error?: string;
    id?: string;
    class?: string;
  };

  const uniqueId = $props.id();
  let {
    value = $bindable(''),
    label,
    description,
    error,
    id,
    class: className = '',
    rows = 4,
    ...restProps
  }: Props = $props();

  const fieldId = $derived(id ?? `${uniqueId}-textarea`);
  const describedBy = $derived(
    error ? `${fieldId}-error` : description ? `${fieldId}-description` : undefined
  );
</script>

<label class={`ui-field ${className}`} for={fieldId}>
  <span class="ui-field__label">{label}</span>
  {#if description}<span class="ui-field__description" id={`${fieldId}-description`}
      >{description}</span
    >{/if}
  <textarea
    {...restProps}
    id={fieldId}
    {rows}
    bind:value
    class:ui-field__control--error={Boolean(error)}
    class="ui-field__control ui-field__textarea"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}></textarea>
  {#if error}<span class="ui-field__error" id={`${fieldId}-error`}>{error}</span>{/if}
</label>
