<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLInputAttributes,
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
    ...restProps
  }: Props = $props();

  const fieldId = $derived(id ?? `${uniqueId}-input`);
  const describedBy = $derived(
    error ? `${fieldId}-error` : description ? `${fieldId}-description` : undefined
  );
</script>

<label class={`ui-field ${className}`} for={fieldId}>
  <span class="ui-field__label">{label}</span>
  {#if description}<span class="ui-field__description" id={`${fieldId}-description`}
      >{description}</span
    >{/if}
  <input
    {...restProps}
    id={fieldId}
    bind:value
    class:ui-field__control--error={Boolean(error)}
    class="ui-field__control"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}
  />
  {#if error}<span class="ui-field__error" id={`${fieldId}-error`}>{error}</span>{/if}
</label>
