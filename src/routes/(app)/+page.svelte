<script lang="ts">
  import type { PageProps } from './$types';
  import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    PageHeader,
    SectionHeading
  } from '$lib/components/ui';

  let { data }: PageProps = $props();

  const fullName = $derived([data.user.firstName, data.user.lastName].filter(Boolean).join(' '));
</script>

<svelte:head>
  <title>Главная · VPN Mini App</title>
  <meta name="description" content="Telegram Mini App для управления защищённым VPN-подключением" />
</svelte:head>

<PageHeader title="Главная" id="home-title" />

<div class="welcome-row">
  <Avatar name={fullName} photoUrl={data.user.photoUrl} size="md" />
  <div>
    <span>С возвращением,</span>
    <strong>{data.user.firstName}!</strong>
  </div>
</div>

<div class="benefit-grid" aria-label="Преимущества сервиса">
  <div class="info-chip"><Icon name="bolt" size={17} /><span>Быстро</span></div>
  <div class="info-chip"><Icon name="shield" size={17} /><span>Безопасно</span></div>
  <div class="info-chip"><Icon name="globe" size={17} /><span>Приватно</span></div>
</div>

<SectionHeading title="Текущий план" />
<Card>
  <div class="card-heading-row">
    <h3>Плана пока нет</h3>
    <Badge dot>Неактивен</Badge>
  </div>
  <p class="card-copy">
    Тарифы появятся здесь после настройки каталога. Ваш профиль уже готов к безопасному подключению.
  </p>
  <Button disabled>Тарифы скоро появятся</Button>
</Card>

<p class="privacy-note">
  <Icon name="lock" size={18} />
  <span>Никаких логов трафика. Только защищённое соединение.</span>
</p>
