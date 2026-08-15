<script lang="ts">
  import {
    Avatar,
    Badge,
    Button,
    Card,
    EmptyState,
    ErrorState,
    FAQAccordion,
    Icon,
    Input,
    Modal,
    PlanCard,
    Skeleton,
    Textarea,
    Toast,
    type FAQItem
  } from '$lib/components/ui';

  const faqItems: readonly FAQItem[] = [
    {
      id: 'fixture-one',
      question: 'Можно ли открыть несколько пунктов?',
      answer:
        'Да. Каждый пункт использует нативный элемент details и остаётся доступным с клавиатуры.'
    },
    {
      id: 'fixture-two',
      question: 'Что показывает эта страница?',
      answer: 'Стабильные состояния базовых компонентов до подключения продуктовых данных.'
    }
  ];

  let displayName = $state('Герман');
  let promoCode = $state('');
  let message = $state('Проверяю многострочное поле и его подсказку.');
  let selectedPlan = $state<'week' | 'month'>('month');
  let modalOpen = $state(false);
  let toastVisible = $state(true);

  const messageLength = $derived(message.length);
</script>

<svelte:head>
  <title>UI Kitchen Sink · VPN Mini App</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#snippet modalFooter()}
  <Button variant="secondary" onclick={() => (modalOpen = false)}>Отмена</Button>
  <Button onclick={() => (modalOpen = false)}>Подтвердить</Button>
{/snippet}

<main class="kitchen-sink" data-testid="kitchen-sink">
  <header class="kitchen-sink__header">
    <h1>UI Kitchen Sink</h1>
    <p>
      Визуальный контракт базовых компонентов: hand-drawn геометрия, синий акцент, доступные
      состояния и Telegram-friendly touch targets.
    </p>
  </header>

  <section class="kitchen-sink__section" aria-labelledby="buttons-heading">
    <h2 id="buttons-heading">Buttons</h2>
    <div class="kitchen-sink__button-row">
      <Button>Основная кнопка</Button>
      <Button variant="secondary">Вторичная</Button>
      <Button variant="ghost"><Icon name="help" size={19} /> Тихая</Button>
      <Button variant="danger">Опасное действие</Button>
      <Button loading>Загрузка</Button>
      <Button disabled>Недоступно</Button>
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="badges-heading">
    <h2 id="badges-heading">Badges</h2>
    <div class="kitchen-sink__badge-row">
      <Badge dot>Неактивен</Badge>
      <Badge tone="info">Информация</Badge>
      <Badge tone="success"><Icon name="check" size={14} /> Готово</Badge>
      <Badge tone="warning">Ожидание</Badge>
      <Badge tone="danger">Ошибка</Badge>
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="cards-heading">
    <h2 id="cards-heading">Cards</h2>
    <div class="kitchen-sink__grid">
      <Card>
        <h3>Sketch card</h3>
        <p class="card-copy">Основной контейнер с неровной рамкой и контрастной тенью.</p>
        <Button>Продолжить</Button>
      </Card>
      <Card variant="soft">
        <h3>Soft card</h3>
        <p class="card-copy">Спокойная поверхность для вторичной информации.</p>
      </Card>
      <Card variant="plain">
        <h3>Plain card</h3>
        <p class="card-copy">Нейтральная карточка без декоративной тени.</p>
      </Card>
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="plans-heading">
    <h2 id="plans-heading">Plan cards</h2>
    <div class="kitchen-sink__grid">
      <PlanCard
        name="Неделя"
        description="Короткий период для знакомства с сервисом."
        days={7}
        amountMinor={399}
        currency="eur"
        selected={selectedPlan === 'week'}
        onSelect={() => (selectedPlan = 'week')}
      />
      <PlanCard
        name="Месяц"
        description="Базовый демонстрационный вариант."
        days={30}
        amountMinor={1099}
        currency="eur"
        selected={selectedPlan === 'month'}
        onSelect={() => (selectedPlan = 'month')}
      />
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="fields-heading">
    <h2 id="fields-heading">Fields</h2>
    <div class="kitchen-sink__grid">
      <div class="kitchen-sink__stack">
        <Input
          label="Имя"
          description="Публичное имя в интерфейсе"
          autocomplete="name"
          bind:value={displayName}
        />
        <Input
          label="Промокод"
          placeholder="Например, WELCOME"
          error="Демонстрация текста ошибки"
          bind:value={promoCode}
        />
      </div>
      <Textarea
        label="Сообщение"
        description={`${messageLength} символов из 2000`}
        maxlength={2000}
        bind:value={message}
      />
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="identity-heading">
    <h2 id="identity-heading">Identity</h2>
    <div class="kitchen-sink__badge-row">
      <Avatar name={displayName} size="sm" />
      <Avatar name={displayName} size="md" />
      <Avatar name={displayName} size="lg" />
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="feedback-heading">
    <h2 id="feedback-heading">Feedback and loading</h2>
    <div class="kitchen-sink__grid">
      <Card variant="plain">
        <EmptyState
          title="Здесь пока пусто"
          description="Добавьте первый объект, чтобы он появился в списке."
        >
          {#snippet action()}<Button variant="secondary">Добавить</Button>{/snippet}
        </EmptyState>
      </Card>
      <Card variant="plain" padding="none">
        <ErrorState
          message="Не удалось загрузить данные. Проверьте соединение и попробуйте снова."
          onRetry={() => (toastVisible = true)}
        />
      </Card>
      <Skeleton lines={4} />
    </div>
    <div class="kitchen-sink__toast-preview">
      <Toast message="Настройки сохранены" tone="success" visible={toastVisible} />
    </div>
  </section>

  <section class="kitchen-sink__section" aria-labelledby="accordion-heading">
    <h2 id="accordion-heading">Accordion and dialog</h2>
    <div class="kitchen-sink__grid">
      <FAQAccordion items={faqItems} openFirst />
      <Card variant="soft">
        <h3>Modal</h3>
        <p class="card-copy">Нативный dialog с фокусом, Escape и закрытием по фону.</p>
        <Button onclick={() => (modalOpen = true)}>Открыть диалог</Button>
      </Card>
    </div>
  </section>
</main>

<Modal bind:open={modalOpen} title="Подтвердите действие" footer={modalFooter}>
  <p>Это демонстрационное окно не изменяет данные.</p>
</Modal>
