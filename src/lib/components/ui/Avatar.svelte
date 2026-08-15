<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    name: string;
    photoUrl?: string | null;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let { name, photoUrl = null, size = 'md', class: className = '' }: Props = $props();
  let failedPhotoUrl = $state<string | null>(null);

  function handlePhotoError(): void {
    if (photoUrl) failedPhotoUrl = photoUrl;
  }
</script>

<span class={`ui-avatar ui-avatar--${size} ${className}`}>
  {#if photoUrl && photoUrl !== failedPhotoUrl}
    <img
      src={photoUrl}
      alt=""
      loading="eager"
      referrerpolicy="no-referrer"
      onerror={handlePhotoError}
    />
  {:else}
    <Icon name="user" size={size === 'lg' ? 50 : size === 'md' ? 31 : 22} />
  {/if}
  <span class="sr-only">Аватар пользователя {name}</span>
</span>
