<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { ProfileSection, type ProfileViewUser } from '$lib/features/profile';
  import GlassNavIsland from './GlassNavIsland.svelte';
  import SupportSection from './SupportSection.svelte';
  import SwipePager from './SwipePager.svelte';
  import { navigationItems, type SectionId } from './navigation';

  type AppTheme = 'light' | 'dark' | 'system';
  type TelegramTheme = Exclude<AppTheme, 'system'>;

  interface TelegramWebApp {
    colorScheme?: string;
    ready(): void;
    expand(): void;
    onEvent?(event: 'themeChanged', listener: () => void): void;
    offEvent?(event: 'themeChanged', listener: () => void): void;
  }

  interface Props {
    user: ProfileViewUser;
    children: Snippet;
    theme?: AppTheme;
  }

  let { user, children, theme = 'system' }: Props = $props();
  let activeSection = $state<SectionId>('home');
  let telegramTheme = $state<TelegramTheme>();

  onMount(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    const syncTheme = (): void => {
      telegramTheme = isTelegramTheme(webApp.colorScheme) ? webApp.colorScheme : undefined;
    };

    syncTheme();
    webApp.ready();
    webApp.expand();
    webApp.onEvent?.('themeChanged', syncTheme);

    return () => webApp.offEvent?.('themeChanged', syncTheme);
  });

  const activeLabel = $derived(
    navigationItems.find((item) => item.id === activeSection)?.label ?? 'Главная'
  );
  const resolvedTheme = $derived(theme === 'system' ? telegramTheme : theme);
  const resolvedThemeSource = $derived(
    theme === 'system' ? (telegramTheme ? 'telegram' : undefined) : 'explicit'
  );

  function navigate(section: SectionId): void {
    activeSection = section;
  }

  function navigateFromContent(section: SectionId): void {
    navigate(section);
    requestAnimationFrame(() => document.getElementById(`${section}-title`)?.focus());
  }

  function getTelegramWebApp(): TelegramWebApp | undefined {
    const telegramWindow = window as Window & {
      Telegram?: { WebApp?: TelegramWebApp };
    };
    return telegramWindow.Telegram?.WebApp;
  }

  function isTelegramTheme(value: string | undefined): value is TelegramTheme {
    return value === 'light' || value === 'dark';
  }
</script>

{#snippet support()}
  <SupportSection />
{/snippet}

{#snippet profile()}
  <ProfileSection {user} onChoosePlan={() => navigateFromContent('home')} />
{/snippet}

<main
  class="app-shell"
  data-theme={resolvedTheme}
  data-theme-source={resolvedThemeSource}
  data-testid="app-shell"
>
  <SwipePager {activeSection} onChange={navigate} {support} home={children} {profile} />
  <GlassNavIsland {activeSection} onChange={navigate} />
  <span class="sr-only" aria-live="polite">Открыта секция «{activeLabel}»</span>
</main>
