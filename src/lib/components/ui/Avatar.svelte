<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    name: string;
    photoUrl?: string | null;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let { name, photoUrl = null, size = 'md', class: className = '' }: Props = $props();
</script>

<span class={`ui-avatar ui-avatar--${size} ${className}`}>
  {#if photoUrl}
    <img src={photoUrl} alt="" loading="lazy" referrerpolicy="no-referrer" />
  {:else}
    <Icon name="user" size={size === 'lg' ? 50 : size === 'md' ? 31 : 22} />
  {/if}
  <span class="sr-only">Аватар пользователя {name}</span>
</span>
