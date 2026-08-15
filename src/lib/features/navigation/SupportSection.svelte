<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Button,
    Card,
    FAQAccordion,
    Icon,
    PageHeader,
    SectionHeading,
    Toast,
    type FAQItem
  } from '$lib/components/ui';

  const faqItems: readonly FAQItem[] = [
    {
      id: 'how-it-works',
      question: 'Как работает VPN?',
      answer:
        'VPN создаёт защищённый туннель между вашим устройством и сервером, скрывая реальный IP-адрес и шифруя трафик.'
    },
    {
      id: 'supported-platforms',
      question: 'Какие устройства поддерживаются?',
      answer:
        'VLESS можно настроить на iOS, Android, macOS, Windows и других платформах с совместимым клиентом.'
    },
    {
      id: 'connection-help',
      question: 'Что делать, если VPN не подключается?',
      answer:
        'Проверьте интернет-соединение и перезапустите клиент. Если проблема осталась, создайте обращение в поддержку.'
    }
  ];

  let noticeVisible = $state(false);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function showNotice(): void {
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeVisible = true;
    noticeTimer = setTimeout(() => {
      noticeVisible = false;
    }, 2600);
  }

  onDestroy(() => {
    if (noticeTimer) clearTimeout(noticeTimer);
  });
</script>

<PageHeader title="Поддержка" id="support-title" />

<SectionHeading title="Частые вопросы" />
<FAQAccordion items={faqItems} openFirst />

<SectionHeading title="Написать нам" />
<Card class="support-card">
  <span class="support-card__icon"><Icon name="help" size={27} /></span>
  <h3>Мы рядом</h3>
  <p>
    Форма обращения подключается отдельным защищённым срезом. Ответы на частые вопросы уже доступны.
  </p>
  <Button onclick={showNotice}>Создать обращение</Button>
</Card>

<Toast message="Форма поддержки появится в следующем обновлении" visible={noticeVisible} />
