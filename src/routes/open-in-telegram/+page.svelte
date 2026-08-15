<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';

  type AuthState = 'checking' | 'outside' | 'failed';
  type TelegramWebApp = Readonly<{
    initData: string;
    ready(): void;
    expand(): void;
  }>;

  let { data }: PageProps = $props();
  let state = $state<AuthState>('checking');

  const telegramUrl = $derived(`https://t.me/${data.telegramBotUsername}?startapp`);

  onMount(() => {
    void authenticate();
  });

  async function authenticate(): Promise<void> {
    state = 'checking';
    const webApp = getTelegramWebApp();

    if (!webApp?.initData) {
      state = 'outside';
      return;
    }

    webApp.ready();
    webApp.expand();

    try {
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: webApp.initData
      });

      if (!response.ok) {
        state = 'failed';
        return;
      }

      await goto(resolve('/'), { replaceState: true });
    } catch {
      state = 'failed';
    }
  }

  function getTelegramWebApp(): TelegramWebApp | undefined {
    const telegramWindow = window as Window & {
      Telegram?: { WebApp?: TelegramWebApp };
    };
    return telegramWindow.Telegram?.WebApp;
  }
</script>

<svelte:head>
  <title>Откройте VPN в Telegram</title>
  <meta
    name="description"
    content="VPN Mini App доступно через Telegram, где безопасно подтверждается ваш аккаунт."
  />
</svelte:head>

<main class="telegram-gate">
  <section class="telegram-gate__card" aria-live="polite">
    <span class="telegram-gate__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="m21 4-3 16-6-4-3 3v-5l8-7-10 6-4-2 18-7Z" />
      </svg>
    </span>

    {#if state === 'checking'}
      <span class="telegram-gate__eyebrow">Telegram Mini App</span>
      <h1>Проверяем вход</h1>
      <p>Подтверждаем аккаунт через защищённые данные Telegram.</p>
      <span class="telegram-gate__loader" aria-label="Загрузка"></span>
    {:else if state === 'outside'}
      <span class="telegram-gate__eyebrow">Telegram Mini App</span>
      <h1>Откройте приложение через Telegram</h1>
      <p>Так мы безопасно подтвердим ваш аккаунт и покажем персональный VPN-профиль.</p>
      <a class="telegram-gate__button" href={telegramUrl} rel="external">Открыть в Telegram</a>
    {:else}
      <span class="telegram-gate__eyebrow">Не удалось войти</span>
      <h1>Обновите Mini App</h1>
      <p>Данные Telegram могли устареть. Закройте окно, откройте бота снова или повторите вход.</p>
      <button class="telegram-gate__button" type="button" onclick={authenticate}>Повторить</button>
    {/if}

    <small>Исходные данные Telegram не сохраняются.</small>
  </section>
</main>

<style>
  .telegram-gate {
    display: grid;
    min-height: 100dvh;
    padding: max(28px, env(safe-area-inset-top)) 22px max(28px, env(safe-area-inset-bottom));
    place-items: center;
    color: var(--app-text);
    background: var(--app-bg);
  }

  .telegram-gate__card {
    display: grid;
    width: min(100%, 420px);
    justify-items: center;
    padding: 38px 26px 30px;
    text-align: center;
    background: var(--app-surface);
    border: 2px solid var(--app-ink);
    border-radius: 27px 22px 30px 20px / 23px 29px 22px 31px;
    box-shadow: 7px 8px 0 var(--app-ink);
  }

  .telegram-gate__mark {
    display: grid;
    width: 72px;
    height: 72px;
    margin-bottom: 22px;
    place-items: center;
    color: #fff;
    background: var(--app-blue);
    border: 2px solid var(--app-ink);
    border-radius: 50% 45% 55% 47%;
    box-shadow: 4px 4px 0 var(--app-ink);
  }

  .telegram-gate__mark svg {
    width: 38px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .telegram-gate__eyebrow {
    color: var(--app-blue);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 340px;
    margin: 10px 0 12px;
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(27px, 8vw, 36px);
    line-height: 1.04;
  }

  p {
    max-width: 330px;
    margin: 0 0 24px;
    color: var(--app-muted);
    font-size: 15px;
    line-height: 1.5;
  }

  small {
    margin-top: 22px;
    color: var(--app-muted);
    font-size: 11px;
  }

  .telegram-gate__button {
    display: grid;
    width: 100%;
    min-height: 52px;
    place-items: center;
    padding: 12px 18px;
    color: #fff;
    background: var(--app-button);
    border: 3px solid var(--app-ink);
    border-radius: 25px 29px 22px 27px / 26px 21px 29px 23px;
    box-shadow: -5px 4px 0 var(--app-ink);
    font:
      800 17px/1 'Courier New',
      Courier,
      monospace;
    text-decoration: none;
    cursor: pointer;
  }

  .telegram-gate__button:focus-visible {
    outline: 3px solid #7c85ff;
    outline-offset: 3px;
  }

  .telegram-gate__loader {
    width: 34px;
    height: 34px;
    border: 4px solid var(--app-line);
    border-top-color: var(--app-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .telegram-gate__loader {
      animation: none;
    }
  }
</style>
