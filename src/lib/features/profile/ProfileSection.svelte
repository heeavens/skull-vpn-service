<script lang="ts">
  import {
    Avatar,
    Badge,
    Button,
    Card,
    EmptyState,
    Icon,
    PageHeader,
    SectionHeading
  } from '$lib/components/ui';
  import type { ProfileViewUser } from './profile.types';

  interface Props {
    user: ProfileViewUser;
    onChoosePlan: () => void;
  }

  let { user, onChoosePlan }: Props = $props();

  const fullName = $derived([user.firstName, user.lastName].filter(Boolean).join(' '));
  const username = $derived(user.username ? `@${user.username}` : 'Username не указан');
  const language = $derived(user.languageCode?.toUpperCase() ?? '—');
</script>

<PageHeader title="Профиль" id="profile-title" />

<div class="profile-identity">
  <Avatar name={fullName} photoUrl={user.photoUrl} size="lg" />
  <div class="profile-identity__name">
    <h2>{fullName}</h2>
    <p>{username}</p>
  </div>
  {#if user.isAdmin}<Badge tone="info"><Icon name="crown" size={14} /> Администратор</Badge>{/if}
</div>

<SectionHeading title="Подписка" />
<Card>
  <EmptyState
    title="Подписки пока нет"
    description="После выбора тарифа здесь появятся срок действия и данные для подключения."
    icon="shield"
  >
    {#snippet action()}
      <Button onclick={onChoosePlan}>Перейти на главную</Button>
    {/snippet}
  </EmptyState>
</Card>

<div class="profile-meta" aria-label="Данные профиля">
  <div>
    <span>Язык</span>
    <strong>{language}</strong>
  </div>
  <div>
    <span>Статус</span>
    <strong>{user.isAdmin ? 'Admin' : 'User'}</strong>
  </div>
</div>

{#if user.isAdmin}
  <SectionHeading title="Управление" />
  <Card variant="soft" padding="sm" class="admin-preview">
    <span class="admin-preview__icon"><Icon name="crown" size={24} /></span>
    <div>
      <h3>Админ-панель</h3>
      <p>Инструменты управления появятся после подключения каталога.</p>
    </div>
  </Card>
{/if}
