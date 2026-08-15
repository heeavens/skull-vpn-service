<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { ProfileSection, type ProfileViewUser } from '$lib/features/profile';
  import GlassNavIsland from './GlassNavIsland.svelte';
  import SupportSection from './SupportSection.svelte';
  import SwipePager from './SwipePager.svelte';
  import { navigationItems, type SectionId } from './navigation';

  type AppTheme = 'light' | 'dark' | 'system';

  interface Props {
    user: ProfileViewUser;
    children: Snippet;
    theme?: AppTheme;
  }

  let { user, children, theme = 'system' }: Props = $props();
  let activeSection = $state<SectionId>('home');
  let hydrated = $state(false);

  onMount(() => {
    hydrated = true;
  });

  const activeLabel = $derived(
    navigationItems.find((item) => item.id === activeSection)?.label ?? 'Главная'
  );

  function navigate(section: SectionId): void {
    activeSection = section;
  }
</script>

{#snippet support()}
  <SupportSection />
{/snippet}

{#snippet profile()}
  <ProfileSection {user} onChoosePlan={() => navigate('home')} />
{/snippet}

<main
  class="app-shell"
  data-theme={theme === 'system' ? undefined : theme}
  data-hydrated={hydrated}
  data-testid="app-shell"
>
  <SwipePager {activeSection} onChange={navigate} {support} home={children} {profile} />
  <GlassNavIsland {activeSection} onChange={navigate} />
  <span class="sr-only" aria-live="polite">Открыта секция «{activeLabel}»</span>
</main>
