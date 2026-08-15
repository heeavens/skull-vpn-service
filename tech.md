# Техническое задание: VPN Telegram Mini App + Marzban

**Версия:** 1.0
**Статус:** Draft для согласования  
**Дата:** 15 августа 2026  
**Источник истины:** этот файл  
**Состав команды:** один разработчик и тимлид

## Changelog

- v1.0: зафиксированы продуктовые требования, архитектура, схема данных, контракты интеграций, безопасность, тестирование и план реализации.

## 1. Цель проекта

Разработать Telegram Mini App для продажи и управления подпиской на VPN. Приложение должно:

- авторизовывать пользователя по его Telegram-аккаунту;
- показывать доступные тарифы;
- принимать оплату за подписку;
- создавать или продлевать VPN-доступ в Marzban;
- показывать активную подписку, QR-код и ссылку подключения;
- принимать обращения в поддержку;
- предоставлять защищённую админ-панель владельцу сервиса.

Marzban и приложение размещаются на одном VPS. Marzban управляет пользователями и подключениями Xray/VLESS. SvelteKit-приложение отвечает за продуктовую логику, Telegram-интерфейс, оплаты, тарифы, промокоды, поддержку и историю покупок.

Telegram Mini App не является отдельным нативным приложением. Telegram открывает HTTPS-адрес SvelteKit-приложения во встроенном WebView.

## 2. Границы MVP

### Входит в MVP

- один VPS;
- один Telegram-бот и одна Mini App;
- один администратор;
- авторизация через Telegram Mini Apps initData;
- три основные секции: Поддержка, Главная, Профиль;
- свайп между секциями и нижняя навигация;
- тарифы на 7, 30 и 90 дней как начальные данные;
- CRUD тарифов в админ-панели;
- Stripe Checkout в test mode как способ оплаты;
- промокоды;
- история покупок;
- один VPN-профиль Marzban на одного Telegram-пользователя;
- создание и продление доступа VLESS;
- QR-код и subscription URL Marzban;
- FAQ;
- создание обращения и отправка уведомления администратору;
- журнал административных действий;
- резервные копии и базовый мониторинг.

### Не входит в MVP

- несколько администраторов и ролевая модель;
- реферальная программа;
- автоматическое регулярное списание;
- семейные и многопользовательские подписки;
- лимиты по числу устройств;
- отдельные мобильные приложения;
- несколько VPN-серверов и автоматическое переключение между ними;
- покупка через банковскую карту внутри Telegram Mini App;
- полноценный чат поддержки в реальном времени;
- управление Xray inbound-конфигурацией из пользовательской админ-панели;
- аналитическая платформа и маркетинговые интеграции.

## 3. Обязательные продуктовые решения

### 3.1. Оплата

Проект является учебным и не принимает реальные платежи. Оплата реализуется через Stripe Checkout только в test mode. Использование live secret key и создание реальных списаний запрещено требованиями проекта.

Проект должен использовать следующий процесс:

1. Пользователь выбирает тариф и при необходимости применяет промокод.
2. Сервер повторно получает тариф из БД и сам рассчитывает итоговую цену.
3. Сервер создаёт заказ со снимком названия, длительности, валюты и цены тарифа.
4. Сервер создаёт Stripe Checkout Session в режиме payment, передавая рассчитанную цену через line_items.price_data.
5. Для POST-запроса к Stripe используется idempotency key, основанный на order ID.
6. Stripe metadata и client_reference_id содержат внутренний order ID.
7. Клиент получает только URL созданной Checkout Session и переходит на Stripe-hosted checkout.
8. После тестовой оплаты Stripe возвращает пользователя на success_url.
9. Success page показывает состояние заказа, но сама не активирует VPN.
10. Единственным источником подтверждения оплаты является подписанный Stripe webhook.
11. После checkout.session.completed сервер проверяет payment_status, order ID, currency и amount_total.
12. Только после подтверждённого webhook заказ переводится в paid и создаётся job vpn.provision.
13. Обработка Stripe event идемпотентна: повторная доставка события не создаёт вторую покупку и не продлевает подписку повторно.

Перед оплатой пользователь должен получить ссылки на условия использования, политику конфиденциальности и правила возврата и явно подтвердить согласие.

Для MVP используется Stripe-hosted Checkout с оплатой картой. Валюта фиксирована как EUR. Суммы хранятся целым числом в минимальных единицах валюты, то есть в центах для EUR. Карточные данные вводятся только на странице Stripe и не проходят через сервер приложения.

Официальная документация: [Stripe Checkout quickstart](https://docs.stripe.com/checkout/quickstart), [Stripe test mode](https://docs.stripe.com/testing-use-cases), [идемпотентные запросы Stripe](https://docs.stripe.com/api/idempotent_requests).

### 3.2. Правило продления подписки

По умолчанию используется накопительное продление:

- если подписка активна, новая длительность добавляется к текущей дате окончания;
- если подписка истекла, новая длительность отсчитывается от момента подтверждённой оплаты;
- повторная обработка одного платежа не меняет дату окончания второй раз;
- один пользователь имеет один Marzban-профиль и один актуальный subscription URL.

Формула:

newExpiresAt = max(currentExpiresAt, paidAt) + planDurationDays.

Это правило должно быть подтверждено владельцем до реализации оплаты.

### 3.3. Удаление данных, связанных с покупками

Тариф или промокод, который уже использовался, нельзя физически удалить. Кнопка удаления выполняет soft delete или архивирование. История покупок продолжает показывать значения из снимка заказа.

## 4. Технологический стек

### 4.1. Основной стек

- SvelteKit, TypeScript, adapter-node;
- Svelte 5;
- Tailwind CSS;
- SQLite;
- Drizzle ORM и Drizzle Kit;
- better-sqlite3 как стабильный Node.js-драйвер;
- Docker и Docker Compose;
- Marzban и Xray-core;
- VLESS как единственный пользовательский VPN-протокол MVP.

### 4.2. Рекомендуемые вспомогательные зависимости

- Zod для проверки входных данных и payload фоновых задач;
- qrcode для генерации QR-кода;
- официальный Stripe Node.js SDK;
- Vitest для unit и integration тестов;
- Playwright для end-to-end тестов;
- ESLint и Prettier;
- Caddy как reverse proxy и автоматическое управление TLS;
- pnpm и актуальная LTS-версия Node.js.

Версии зависимостей фиксируются lock-файлом. Обновление major-версий выполняется отдельной задачей после проверки changelog и тестов.

## 5. Архитектура на одном VPS

| Сервис | Назначение | Публичный доступ |
| --- | --- | --- |
| Caddy | TLS, reverse proxy и security headers | 80 и 443 |
| app | SvelteKit UI, server routes, Telegram auth, Stripe и Telegram webhooks | Только через Caddy |
| worker | Надёжная выдача VPN, повторные попытки, уведомления поддержки, сверка с Marzban | Нет |
| Marzban | Управление Xray-пользователями, сроками действия и subscription URL | API только во внутренней Docker-сети; публичен только необходимый subscription endpoint |
| Xray-core | VLESS inbound и пользовательский трафик | Только настроенные VPN-порты |
| app SQLite volume | Бизнес-данные приложения | Нет |
| Marzban data volume | Собственные данные Marzban | Нет |

### 5.1. Правила изоляции

- БД приложения и БД Marzban независимы.
- Приложение не читает и не изменяет таблицы Marzban напрямую.
- Любое взаимодействие с Marzban выполняется через его REST API.
- Marzban API credentials никогда не передаются в браузер.
- Нативная панель Marzban используется только для технического управления Xray и не заменяет админ-панель Mini App.
- Нативная панель Marzban не должна быть доступна публично без дополнительной защиты. Предпочтительно ограничить доступ VPN, allowlist IP или отдельной сильной аутентификацией.
- Для app, worker и Marzban задаются Docker healthcheck и ограничения ресурсов, чтобы пользовательский VPN-трафик не вытеснял приложение.

Marzban предоставляет REST API и поддерживает VLESS, ограничения по сроку действия и subscription URL: [официальная документация Marzban](https://github.com/Gozargah/Marzban).

## 6. Домены и маршрутизация

Рекомендуемая схема:

- app.example.com: Mini App, публичные документы, Stripe webhook и Telegram webhook;
- sub.example.com: subscription URL пользователей;
- panel.example.com: нативная панель Marzban, закрытая дополнительным контролем доступа;
- VLESS inbound: отдельный порт или 443 в зависимости от выбранной Xray-конфигурации.

Конкретные домены, inbound-теги, transport и TLS/REALITY-конфигурация определяются до production deployment. Бизнес-приложение не должно автоматически менять inbound-конфигурацию.

## 7. Пользователи и доступ

### 7.1. Роли

**Пользователь**

- открывает Mini App;
- просматривает тарифы и FAQ;
- применяет промокод;
- оплачивает подписку;
- видит историю покупок;
- получает QR-код и ссылку подключения;
- создаёт обращение в поддержку.

**Администратор**

- имеет все права пользователя;
- видит точку входа в админ-панель внутри Профиля;
- создаёт, редактирует, архивирует и активирует тарифы;
- создаёт, редактирует, отключает и архивирует промокоды;
- управляет FAQ;
- просматривает заказы, пользователей, подписки и обращения;
- повторно запускает неуспешную выдачу доступа;
- меняет статус обращения;
- просматривает журнал административных действий.

### 7.2. Определение администратора

- В .env хранится ADMIN_TELEGRAM_CHAT_ID.
- Для MVP это должен быть ID личного чата администратора. В личном чате он совпадает с Telegram user ID.
- После серверной проверки initData валидированный user.id сравнивается с ADMIN_TELEGRAM_CHAT_ID.
- Скрытие кнопки в UI не является авторизацией.
- Каждый admin load, action и API endpoint повторно выполняет серверную проверку роли.
- Для будущей отправки обращений в группу допускается отдельная переменная SUPPORT_CHAT_ID. Если она не задана, используется ADMIN_TELEGRAM_CHAT_ID.

## 8. Telegram-аутентификация

### 8.1. Поток входа

1. Клиент получает Telegram.WebApp.initData.
2. Клиент отправляет исходную строку initData на POST /api/auth/telegram.
3. Сервер проверяет подпись по алгоритму Telegram с использованием bot token.
4. Сервер проверяет auth_date и отклоняет устаревшие данные. Рекомендуемое максимальное окно: 5 минут.
5. Сервер извлекает user.id, username, first_name, last_name, photo_url и language_code.
6. Пользователь создаётся или обновляется по telegram_user_id.
7. Сервер создаёт случайную сессию и возвращает Secure, HttpOnly cookie.
8. Все последующие запросы используют серверную сессию.

Нельзя доверять Telegram.WebApp.initDataUnsafe. В БД и бизнес-логику попадают только данные из серверно проверенного initData. Официальный алгоритм: [Telegram Mini Apps, validating data](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

### 8.2. Сессии

- В cookie хранится только случайный непрозрачный токен.
- В БД хранится SHA-256 hash токена, а не исходный токен.
- Cookie: Secure, HttpOnly, SameSite=Lax, Path=/.
- Срок сессии: 7 дней с возможностью обновления после повторной проверки свежего initData.
- Logout удаляет сессию на сервере и cookie.
- Сессии с истёкшим сроком регулярно удаляются worker.
- Серверный hook загружает пользователя в event.locals.
- Доступ к защищённым операциям проверяется непосредственно в server load/action или endpoint, а не только в layout.

### 8.3. Запуск вне Telegram

Если Telegram initData отсутствует, приложение не авторизует пользователя и показывает экран «Откройте приложение через Telegram». Публично доступны только health endpoints и юридические документы.

## 9. Навигация и UI

### 9.1. Основные секции

Порядок секций слева направо:

1. Поддержка.
2. Главная.
3. Профиль.

После успешной авторизации по умолчанию открывается Главная.

### 9.2. Свайп

- Все три секции находятся в одном горизонтальном pager-контейнере.
- Ширина каждой секции равна ширине viewport.
- Между секциями можно переключаться горизонтальным свайпом.
- Короткое вертикальное движение не должно случайно переключать секцию.
- Горизонтальный жест считается свайпом после прохождения заданного порога и доминирования над вертикальным движением.
- Вложенный вертикальный скролл каждой секции сохраняется.
- После свайпа активная кнопка нижней навигации обновляется.
- Нажатие кнопки плавно перемещает к соответствующей секции.
- При prefers-reduced-motion плавная анимация отключается.
- Состояние формы поддержки и промокода не теряется при случайном свайпе.

Предпочтительная реализация: CSS scroll snap с небольшим контроллером на Svelte 5 runes. Не добавлять тяжёлую carousel-библиотеку без подтверждённой необходимости.

### 9.3. Нижний navigation island

- Островок фиксирован над нижней safe area.
- Стиль: Apple Liquid Glass как визуальное направление, без копирования закрытых системных компонентов.
- Используются полупрозрачный фон, blur, тонкая светлая граница и мягкая тень.
- Обязателен fallback для устройств без backdrop-filter и для режима повышенного контраста.
- Три кнопки: Поддержка, Главная, Профиль.
- Активная кнопка имеет отчётливое состояние, различимое не только цветом.
- Touch target каждой кнопки не меньше 44 на 44 CSS px.
- Учитываются env(safe-area-inset-bottom), Telegram theme CSS variables, светлая и тёмная темы.

### 9.4. Общие UI-компоненты

| Компонент | Назначение | Основные параметры |
| --- | --- | --- |
| AppShell | Telegram theme, safe areas, loading и auth states | user, theme |
| SwipePager | Три свайпаемые секции | activeSection, onChange |
| GlassNavIsland | Нижняя навигация | items, activeId |
| PageHeader | Заголовок секции | title, subtitle, action |
| PlanCard | Карточка тарифа | name, days, amountMinor, currency, selected |
| Button | Основное действие | variant, size, loading, disabled |
| Input и Textarea | Формы | value, error, label |
| Card | Базовый контейнер | variant, padding |
| Badge | Статус | tone, label |
| Modal или Sheet | Подтверждения и mobile actions | open, title |
| Toast | Результат операции | tone, message |
| FAQAccordion | Список FAQ | items |
| SupportForm | Создание обращения | category, message |
| PromoCodeForm | Применение кода | code, state, discount |
| PurchaseHistoryList | История заказов | orders, pagination |
| ActiveSubscriptionCard | Текущий доступ | expiresAt, status, link |
| QRCodeView | QR subscription URL | value, maskedLabel |
| AdminDataTable | Таблицы админ-панели | columns, rows, actions |
| ConfirmDialog | Опасные действия | title, confirmLabel |
| EmptyState | Пустые списки | title, description |
| Skeleton и ErrorState | Загрузка и ошибки | variant, retry |

Общие примитивы размещаются в src/lib/components/ui. Компоненты конкретной фичи остаются внутри своей feature-папки.

## 10. Функциональные требования

### 10.1. Главная

- Загружает только активные, неархивированные тарифы с заданной ценой.
- Начальный seed содержит тарифы длительностью 7, 30 и 90 дней.
- Цена и длительность берутся с сервера.
- Карточка показывает название, длительность, форматированную цену и краткое описание.
- Пользователь выбирает один тариф и переходит к подтверждению.
- Если в Профиле применён действующий промокод, экран подтверждения показывает исходную цену, скидку и итог.
- Сервер никогда не принимает цену и размер скидки от клиента как источник истины.
- После успешной оплаты пользователь видит состояние «выдаём доступ», затем актуальный профиль.
- При ошибке Marzban платёж остаётся зарегистрированным, а выдача повторяется worker; пользователь видит понятный статус и может обратиться в поддержку.

### 10.2. Поддержка

**FAQ**

- Показывает активные записи в заданном порядке.
- Запись содержит вопрос и ответ.
- FAQ управляется администратором.

**Форма обращения**

- Поля: категория, текст сообщения.
- Категории MVP: подключение, оплата, скорость, другое.
- Текст обязателен, рекомендуемый предел: от 10 до 2000 символов.
- Вложения не поддерживаются в MVP.
- После отправки обращение сохраняется в БД до отправки уведомления.
- Worker отправляет администратору сообщение через Telegram Bot API.
- Сообщение содержит ID обращения, Telegram user ID, username при наличии, категорию и экранированный текст.
- Если Bot API временно недоступен, обращение не теряется и уведомление повторяется.
- Форма защищена от спама rate limit и минимальным интервалом между обращениями.
- Администратор должен заранее открыть личный чат с ботом, иначе бот не сможет присылать сообщения.

Минимальный MVP не требует ответа пользователю внутри приложения. Администратор отвечает пользователю вручную в Telegram. В админ-панели можно изменить статус обращения на open, in_progress или closed. Встроенный двусторонний чат является отдельной следующей стадией.

### 10.3. Профиль

- Показывает актуальные username, имя и фамилию, если они доступны.
- Показывает Telegram-аватар или нейтральный fallback.
- Обновляет профильные данные при каждой успешной Telegram-аутентификации.
- Содержит форму промокода.
- Содержит историю покупок от новых к старым.
- Содержит активный тариф, дату окончания и статус.
- При активной подписке показывает QR-код и кнопку копирования subscription URL.
- Subscription URL считается секретом доступа, не показывается в логах и не передаётся аналитическим системам.
- QR-код кодирует именно subscription URL Marzban, а не отдельную случайно выбранную VLESS-ссылку.
- Если подписки нет, показывается понятный empty state и кнопка перехода на Главную.
- Для администратора показывает блок входа в админ-панель.

### 10.4. Промокоды

Промокод имеет:

- уникальный код без учёта регистра;
- тип скидки: процент или фиксированная сумма в минимальных единицах валюты;
- значение скидки;
- период действия;
- общий лимит использований;
- лимит использований одним пользователем;
- список применимых тарифов или значение «все тарифы»;
- флаг активности;
- дату архивации.

Правила:

- код нормализуется: trim и uppercase;
- валидация и расчёт выполняются только на сервере;
- процент ограничен диапазоном от 1 до 100;
- итоговая цена не может быть меньше минимальной суммы, заданной бизнес-правилом проекта;
- один заказ использует не более одного промокода;
- использование засчитывается только после подтверждённого Stripe webhook;
- при создании Checkout Session заказ резервирует промокод на срок действия сессии;
- лимит считает оплаченные использования и неистёкшие резервы;
- истёкший pending-заказ освобождает резерв;
- Stripe webhook с корректной завершённой оплатой исполняется даже при пограничном истечении локального резерва: подтверждённый платёж нельзя потерять;
- изменение промокода не меняет уже созданный заказ.

### 10.5. История покупок

Каждая запись показывает:

- дату;
- название и длительность тарифа на момент покупки;
- исходную цену;
- скидку;
- итоговая сумма и валюта;
- статус;
- дату активации или сообщение об ошибке выдачи.

Пагинация обязательна после 20 записей. История доступна только владельцу аккаунта.

### 10.6. Админ-панель

Точка входа находится в Профиле и видна только администратору. Интерфейс может открываться как защищённый вложенный маршрут /admin, сохраняя общий AppShell.

**Тарифы**

- создать;
- редактировать;
- менять название, описание, длительность, цену и порядок;
- вводить цену в евро через админ-форму; сервер безопасно преобразует десятичную строку в целое число центов без вычислений с float;
- активировать и деактивировать;
- архивировать;
- запретить активацию без положительной цены;
- не показывать архивные или неактивные тарифы пользователям.

**Промокоды**

- создать и редактировать;
- активировать и отключать;
- архивировать;
- задавать ограничения;
- видеть число оплаченных использований.

**FAQ**

- создать и редактировать;
- менять порядок;
- активировать и скрывать;
- архивировать.

**Операционный просмотр**

- список пользователей;
- список заказов и платежных статусов;
- список подписок и ошибок синхронизации;
- список обращений;
- ручной retry неуспешной job;
- журнал действий администратора.

Опасные действия требуют ConfirmDialog. Каждая мутация пишет audit log с admin user ID, action, entity type, entity ID и безопасным JSON diff без секретов.

## 11. Интеграция с Marzban

### 11.1. MarzbanClient

В src/lib/server/marzban определяется интерфейс MarzbanClient и его реализации:

- RealMarzbanClient для production;
- FakeMarzbanClient для локальной разработки и тестов.

Минимальные операции:

- authenticate или refreshToken;
- getUser;
- createUser;
- updateUserExpiry;
- getSubscriptionInfo;
- disableUser;
- healthCheck.

HTTP-клиент должен иметь timeout, ограниченные повторные попытки только для безопасных операций и нормализацию ошибок. Логи не содержат access token, subscription URL, UUID VLESS или полный body ответа.

### 11.2. Идентификатор Marzban

- Нельзя использовать изменяемый Telegram username как ключ.
- Нельзя раскрывать Telegram user ID в публичном имени Marzban.
- При первой покупке генерируется стабильное имя из префикса u_ и короткого криптографического hash.
- Связь хранится в subscriptions.marzban_username.
- Создание выполняется идемпотентно: worker сначала проверяет существование пользователя.

### 11.3. Выдача доступа

1. Подписанный Stripe webhook в одной SQLite-транзакции переводит заказ в paid, создаёт payment и job vpn.provision.
2. Worker блокирует job.
3. Worker получает актуальное состояние subscription из БД и пользователя Marzban.
4. Если пользователя нет, создаёт его только с разрешёнными VLESS inbound tags.
5. Рассчитывает новую дату окончания по правилу продления.
6. Обновляет Marzban.
7. Получает subscription URL.
8. Сохраняет срок, статус и зашифрованный URL.
9. Помечает job succeeded.
10. При временной ошибке ставит retry с exponential backoff и jitter.
11. После исчерпания попыток переводит subscription в error и уведомляет администратора.

Нельзя удерживать SQLite-транзакцию открытой во время HTTP-запроса к Marzban.

### 11.4. Сверка

Периодическая job vpn.reconcile:

- проверяет подписки active, pending_activation и error;
- сравнивает expiry и статус с Marzban;
- исправляет безопасные расхождения;
- не сокращает уже оплаченный срок автоматически;
- регистрирует конфликт и уведомляет администратора, если исправление неоднозначно.

## 12. Webhooks и внешние API

### 12.1. Stripe webhook

- В src/lib/server/stripe определяется StripeClient и реализации RealStripeClient и FakeStripeClient.
- RealStripeClient использует официальный Stripe Node.js SDK.
- Минимальные операции: createCheckoutSession, retrieveCheckoutSession и expireCheckoutSession.
- Checkout Session создаётся только с payment_method_types = card и mode = payment.
- Endpoint: POST /api/stripe/webhook.
- Сервер получает raw request body без предварительного JSON parsing.
- Подпись проверяется официальным Stripe SDK по заголовку Stripe-Signature и STRIPE_WEBHOOK_SECRET.
- Webhook event ID сохраняется в stripe_webhook_events и используется для дедупликации.
- checkout.session.completed с payment_status = paid подтверждает оплату.
- checkout.session.expired отменяет неоплаченный заказ и освобождает резерв промокода.
- Перед оплатой сравниваются client_reference_id или metadata.orderId, currency и amount_total со снимком заказа.
- При несовпадении заказ не активируется, событие получает статус failed, администратору отправляется техническое уведомление.
- Endpoint не вызывает Marzban синхронно. Он атомарно сохраняет payment и job vpn.provision, затем быстро возвращает 2xx.
- Повторная доставка уже обработанного event возвращает 2xx без повторного эффекта.
- Success page и query parameter session_id не считаются доказательством оплаты.
- Для локальной разработки webhook пересылается Stripe CLI.

Stripe требует исходное тело запроса для проверки подписи: [официальная документация Stripe webhook signatures](https://docs.stripe.com/webhooks/signature).

### 12.2. Telegram Bot API

- Endpoint: POST /api/telegram/webhook.
- Telegram webhook настраивается с secret_token.
- Сервер обязательно проверяет заголовок X-Telegram-Bot-Api-Secret-Token.
- update_id дедуплицируется.
- Webhook используется для команд бота, но не для оплаты.

Минимально поддерживаются команды:

- /start: приветствие и кнопка открытия Mini App;
- /support: инструкция по обращению;
- /paysupport: инструкция по вопросам оплаты;
- /terms: ссылка на условия;
- /privacy: ссылка на политику конфиденциальности.

## 13. Контракты приложения

### 13.1. Формат ошибки

Все JSON endpoints возвращают единый объект:

    {
      "error": {
        "code": "PROMO_EXPIRED",
        "message": "Promo code has expired",
        "fieldErrors": {},
        "requestId": "..."
      }
    }

Пользовательское сообщение может локализоваться на клиенте по code. Внутренняя ошибка, stack trace и данные внешнего API пользователю не возвращаются.

### 13.2. Основные endpoints

| Метод и путь | Авторизация | Назначение |
| --- | --- | --- |
| POST /api/auth/telegram | initData | Создать или обновить пользователя и сессию |
| POST /api/auth/logout | session | Завершить сессию |
| GET /api/plans | session | Получить активные тарифы |
| POST /api/promos/validate | session | Проверить код для выбранного тарифа |
| POST /api/orders | session | Создать заказ и Stripe Checkout Session |
| GET /api/orders | session | История текущего пользователя |
| GET /api/subscription | session | Активная подписка и ссылка |
| POST /api/support/tickets | session | Создать обращение |
| GET /payments/success | session | Показать состояние заказа после возврата из Stripe |
| GET /payments/cancel | session | Показать отмену Checkout без выдачи доступа |
| POST /api/stripe/webhook | Stripe signature | Подтвердить тестовую оплату |
| POST /api/telegram/webhook | Telegram webhook secret | Команды бота |
| GET /api/admin/* | admin | Административное чтение |
| POST/PATCH/DELETE /api/admin/* | admin | Административные мутации |
| GET /health/live | internal/proxy | Процесс запущен |
| GET /health/ready | internal/proxy | БД доступна, обязательный конфиг загружен |

Формы админ-панели и пользовательские мутации внутри SvelteKit предпочтительно реализовать через server form actions и use:enhance. JSON endpoints оставлять для Stripe и Telegram webhooks, auth handshake и операций, которым действительно нужен программный API.

### 13.3. Общие TypeScript-типы

Общие типы размещаются в src/lib/types:

- AuthenticatedUser;
- PublicPlan;
- PromoQuote;
- OrderSummary;
- SubscriptionSummary;
- SupportTicketSummary;
- ApiErrorCode;
- JobType и JobPayloadMap;
- MarzbanUserSnapshot;
- AdminAuditEvent.

Payload внешней интеграции сначала валидируется runtime-схемой, затем преобразуется во внутренний тип. Не распространять тип Telegram или Marzban по UI напрямую.

## 14. Схема SQLite

Все даты хранятся как UTC Unix timestamp в миллисекундах через Drizzle integer timestamp mode. Денежные значения хранятся как INTEGER в минимальных единицах валюты: для EUR 1099 означает €10.99. Telegram IDs хранятся как TEXT, чтобы не зависеть от ограничений чисел JavaScript.

### 14.1. users

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| telegram_user_id | text | UNIQUE, NOT NULL |
| username | text | nullable |
| first_name | text | NOT NULL |
| last_name | text | nullable |
| photo_url | text | nullable |
| language_code | text | nullable |
| last_auth_at | integer | NOT NULL |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

Индекс: unique telegram_user_id.

### 14.2. sessions

| Поле | Тип | Ограничения |
| --- | --- | --- |
| token_hash | text | PK |
| user_id | text | FK users, NOT NULL |
| expires_at | integer | NOT NULL |
| created_at | integer | NOT NULL |
| last_seen_at | integer | NOT NULL |

Индексы: user_id, expires_at.

### 14.3. plans

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| slug | text | UNIQUE, NOT NULL |
| name | text | NOT NULL |
| description | text | nullable |
| duration_days | integer | NOT NULL, больше 0 |
| price_amount_minor | integer | nullable до настройки |
| currency | text | NOT NULL, default eur |
| sort_order | integer | NOT NULL, default 0 |
| is_active | integer | boolean, NOT NULL |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |
| archived_at | integer | nullable |

Индексы: is_active и sort_order, archived_at. Нельзя активировать тариф без price_amount_minor больше 0 и поддерживаемой currency.

### 14.4. promo_codes

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| code_normalized | text | UNIQUE, NOT NULL |
| discount_type | text | percent или fixed_amount |
| discount_value | integer | NOT NULL, больше 0 |
| starts_at | integer | nullable |
| ends_at | integer | nullable |
| max_redemptions | integer | nullable |
| max_per_user | integer | NOT NULL, default 1 |
| is_active | integer | boolean, NOT NULL |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |
| archived_at | integer | nullable |

Индексы: unique code_normalized, is_active, ends_at.

### 14.5. promo_code_plans

| Поле | Тип | Ограничения |
| --- | --- | --- |
| promo_code_id | text | FK promo_codes |
| plan_id | text | FK plans |

Составной PK: promo_code_id и plan_id. Отсутствие строк для промокода означает применение ко всем тарифам.

### 14.6. orders

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| user_id | text | FK users, NOT NULL |
| plan_id | text | FK plans, NOT NULL |
| promo_code_id | text | FK promo_codes, nullable |
| plan_name_snapshot | text | NOT NULL |
| duration_days_snapshot | integer | NOT NULL |
| base_amount_minor | integer | NOT NULL |
| discount_amount_minor | integer | NOT NULL, default 0 |
| total_amount_minor | integer | NOT NULL |
| currency | text | NOT NULL |
| status | text | pending, checkout_created, paid, cancelled, failed, refunded |
| stripe_checkout_session_id | text | UNIQUE, nullable до создания Checkout |
| checkout_expires_at | integer | nullable |
| terms_version | text | NOT NULL |
| terms_accepted_at | integer | NOT NULL |
| paid_at | integer | nullable |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

Индексы: user_id и created_at, status и checkout_expires_at, promo_code_id. CHECK: total_amount_minor = base_amount_minor - discount_amount_minor, total_amount_minor больше 0.

### 14.7. payments

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| order_id | text | UNIQUE FK orders |
| stripe_checkout_session_id | text | UNIQUE, NOT NULL |
| stripe_payment_intent_id | text | UNIQUE, NOT NULL |
| stripe_event_id | text | UNIQUE, NOT NULL |
| currency | text | NOT NULL |
| amount_total_minor | integer | NOT NULL |
| paid_at | integer | NOT NULL |
| refunded_at | integer | nullable |
| created_at | integer | NOT NULL |

### 14.8. stripe_webhook_events

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, Stripe event ID |
| event_type | text | NOT NULL |
| stripe_object_id | text | nullable |
| status | text | received, processed, ignored, failed |
| error_code | text | nullable |
| created_at | integer | NOT NULL |
| processed_at | integer | nullable |

Raw webhook body не хранится. Stripe event ID достаточно для дедупликации, а безопасные поля сохраняются отдельно.

### 14.9. promo_redemptions

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| promo_code_id | text | FK promo_codes |
| user_id | text | FK users |
| order_id | text | UNIQUE FK orders |
| redeemed_at | integer | NOT NULL |

Индексы: promo_code_id, user_id и promo_code_id.

### 14.10. subscriptions

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| user_id | text | UNIQUE FK users |
| current_plan_id | text | FK plans, nullable |
| marzban_username | text | UNIQUE, NOT NULL |
| status | text | pending_activation, active, expired, suspended, error |
| starts_at | integer | nullable |
| expires_at | integer | nullable |
| subscription_url_encrypted | text | nullable |
| last_synced_at | integer | nullable |
| last_error_code | text | nullable |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

Индексы: user_id, status и expires_at.

### 14.11. faq_items

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| question | text | NOT NULL |
| answer | text | NOT NULL |
| sort_order | integer | NOT NULL |
| is_active | integer | boolean, NOT NULL |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |
| archived_at | integer | nullable |

### 14.12. support_tickets

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, человекочитаемый UUID/ULID |
| user_id | text | FK users, NOT NULL |
| category | text | NOT NULL |
| message | text | NOT NULL |
| status | text | open, in_progress, closed |
| notification_status | text | pending, sent, failed |
| telegram_message_id | text | nullable |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |
| closed_at | integer | nullable |

Индексы: user_id и created_at, status, notification_status.

### 14.13. jobs

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| type | text | vpn.provision, vpn.reconcile, support.notify |
| payload_json | text | NOT NULL, runtime validation |
| idempotency_key | text | UNIQUE, NOT NULL |
| status | text | pending, processing, succeeded, failed |
| attempts | integer | NOT NULL, default 0 |
| max_attempts | integer | NOT NULL |
| run_at | integer | NOT NULL |
| locked_at | integer | nullable |
| locked_by | text | nullable |
| last_error_code | text | nullable |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

Индексы: status и run_at, locked_at.

### 14.14. admin_audit_log

| Поле | Тип | Ограничения |
| --- | --- | --- |
| id | text | PK, UUID |
| admin_user_id | text | FK users |
| action | text | NOT NULL |
| entity_type | text | NOT NULL |
| entity_id | text | NOT NULL |
| diff_json | text | nullable, без секретов |
| request_id | text | NOT NULL |
| created_at | integer | NOT NULL |

Индексы: entity_type и entity_id, created_at.

### 14.15. Миграции и SQLite

- Схема определяется только Drizzle schema files.
- Миграции генерируются Drizzle Kit и хранятся в репозитории.
- Миграции применяются отдельным одноразовым deploy service до запуска app и worker.
- App и worker не пытаются одновременно выполнять миграции.
- В production включаются foreign_keys, WAL mode и busy_timeout.
- Все операции «платёж + заказ + job» выполняются в транзакции.
- Долгий HTTP-запрос никогда не выполняется внутри SQLite-транзакции.
- Файл SQLite находится в постоянном Docker volume, а не внутри image.

Drizzle поддерживает SQLite, ограничения, индексы и транзакции: [SQLite в Drizzle](https://orm.drizzle.team/docs/get-started/sqlite-new), [индексы и ограничения](https://orm.drizzle.team/docs/indexes-constraints), [транзакции](https://orm.drizzle.team/docs/transactions).

## 15. Структура проекта

    src/
      app.d.ts
      hooks.server.ts
      lib/
        components/
          ui/
        features/
          auth/
          navigation/
          plans/
          payments/
          profile/
          promos/
          support/
          admin/
        server/
          auth/
          config/
          crypto/
          db/
            schema/
            repositories/
          jobs/
          marzban/
          stripe/
          telegram/
          payments/
          support/
        types/
        validation/
      routes/
        (app)/
          +layout.server.ts
          +layout.svelte
          +page.server.ts
          +page.svelte
          admin/
        api/
          auth/
          orders/
          plans/
          promos/
          subscription/
          support/
          stripe/
          telegram/
        payments/
        terms/
        privacy/
        health/
    drizzle/
    tests/
      unit/
      integration/
      e2e/
    docker/
    Dockerfile
    compose.yml
    drizzle.config.ts
    svelte.config.js
    .env.example

### 15.1. Границы слоёв

- routes принимают HTTP-запрос, проверяют доступ, валидируют вход и вызывают use case;
- domain/use case содержит бизнес-правила и не зависит от Svelte-компонентов;
- repository скрывает Drizzle-запросы;
- adapters скрывают Stripe, Telegram и Marzban;
- UI получает подготовленные view models, а не строки БД или сырые ответы API;
- внешние клиенты внедряются через интерфейсы, чтобы тесты использовали fake;
- классы применяются для stateful services и adapters, чистые расчёты остаются чистыми функциями;
- не создавать абстракцию до появления понятной границы или повторения.

Это обеспечивает ООП и SOLID без искусственного превращения каждого файла в класс.

## 16. Пять рекомендаций по SvelteKit с максимальным эффектом

### 1. Использовать Svelte 5 runes осознанно

- Локальное изменяемое UI-состояние объявлять через $state.
- Вычисляемые значения, включая итоговую цену в UI и активную секцию, получать через $derived.
- $effect использовать только для внешних side effects: Telegram WebApp API, scroll synchronization, event listeners.
- Не использовать $effect для вычисления данных, которые выражаются через $derived.
- Повторно используемое реактивное состояние выносить в файлы .svelte.ts.
- Не заменять каждый обычный let на $state.

Официальные рекомендации: [Svelte runes](https://svelte.dev/docs/svelte/what-are-runes), [$state](https://svelte.dev/docs/svelte/%24state), [$derived](https://svelte.dev/docs/svelte/%24derived), [Svelte best practices](https://svelte.dev/docs/svelte/best-practices).

### 2. Жёстко разделить server и client

- БД, bot token, Marzban credentials, encryption key и Telegram signature verification размещать только в src/lib/server или файлах .server.ts.
- Секреты импортировать только из private env modules.
- Не хранить пользовательское состояние в module-level переменных server-кода: один Node.js-процесс обслуживает разных пользователей.
- В браузер возвращать только минимальный публичный DTO.

SvelteKit предотвращает импорт src/lib/server в клиентский код: [server-only modules](https://svelte.dev/docs/kit/server-only-modules).

### 3. Использовать стабильные SvelteKit primitives

- Чтение закрытых данных выполнять в +page.server.ts и +layout.server.ts.
- Мутации форм выполнять server form actions с use:enhance.
- +server.ts использовать для Stripe/Telegram webhooks, auth handshake и JSON API.
- Использовать сгенерированные типы PageServerLoad, Actions и RequestHandler.
- Experimental remote functions не использовать в production MVP до отдельного архитектурного решения.

Официальная документация: [load](https://svelte.dev/docs/kit/load), [form actions](https://svelte.dev/docs/kit/form-actions).

### 4. Проверять авторизацию в точке доступа к данным

- hooks.server.ts создаёт event.locals.user.
- Layout может скрывать UI, но не является достаточным security guard.
- Каждый защищённый server load, action и endpoint проверяет пользователя или администратора до чтения и мутации.
- Доступ к объекту всегда ограничивается user_id текущего пользователя, чтобы исключить IDOR.

### 5. Строить вертикальные feature slices и тонкие компоненты

- Одна фича содержит свой UI, validation, use cases и тесты.
- Общими остаются только стабильные UI-примитивы, типы и server infrastructure.
- Компонент отвечает за отображение и события, а не за Telegram/Marzban/SQL.
- Бизнес-правило тестируется как чистая функция или use case без браузера.
- DRY применяется к устойчивому повторению; не объединять похожий код, если у него разные причины меняться.

## 17. Безопасность

### 17.1. Обязательные меры

- HTTPS для Mini App, webhook, subscription endpoint и панели.
- Серверная HMAC-проверка Telegram initData и свежести auth_date.
- Проверка Telegram webhook secret token.
- Проверка Stripe-Signature по raw request body и STRIPE_WEBHOOK_SECRET.
- Запрет Stripe live keys: конфигурация учебного окружения принимает только test keys.
- Secure HttpOnly sessions и хранение только hash токена.
- CSRF-защита для cookie-authenticated mutations.
- Server-side admin guard на каждом admin endpoint.
- Server-side расчёт цен, скидок и сроков.
- Идемпотентность платежей и фоновых задач.
- Уникальные constraints на Stripe event ID, Checkout Session ID, Payment Intent ID, order payment и idempotency key.
- Rate limit для auth, promo validation, orders и support.
- Ограничение длины и runtime validation всех входных данных.
- Экранирование пользовательского текста перед отправкой с Telegram parse mode.
- CSP, Referrer-Policy, Permissions-Policy и корректная настройка frame-ancestors для Telegram Web.
- Запрет wildcard CORS; предпочтительно same-origin.
- Секреты только в .env или Docker secrets, .env не коммитить.
- Разные случайные SESSION_SECRET, DATA_ENCRYPTION_KEY, TELEGRAM_WEBHOOK_SECRET и STRIPE_WEBHOOK_SECRET.
- Шифрование subscription URL в БД с authenticated encryption.
- Маскирование subscription URL, VLESS UUID, токенов и initData в логах.
- Dependency scanning и обновление security patches.
- SSH только по ключам, запрет password login, firewall и минимальный набор портов.
- Docker-контейнеры запускаются без root, если сервис это поддерживает.

### 17.2. Угрозы и контрмеры

| Угроза | Контрмера |
| --- | --- |
| Поддельный Telegram-пользователь | HMAC validation initData |
| Replay старого initData | Проверка auth_date |
| Подмена цены в клиенте | Серверный расчёт по БД и snapshot заказа |
| Повторный Stripe webhook | Unique event/session/payment intent и идемпотентный handler |
| Поддельный Stripe webhook | Проверка Stripe-Signature по raw body |
| Повторная выдача VPN | Уникальная job и проверка обработанного order |
| Доступ к чужой истории | Фильтр по session user_id |
| Вход в админку через скрытый URL | Server-side comparison admin ID |
| Утечка VPN-ссылки | Шифрование, redaction логов, no analytics |
| Исчерпание промокода гонкой | SQLite transaction и временный reservation |
| Спам поддержки | Rate limit, cooldown и длина текста |
| Недоступность Marzban | Durable job, retry и reconciliation |
| Компрометация одного контейнера | Отдельные сети, volumes, least privilege |

### 17.3. Персональные данные

- Хранить только данные, необходимые для аккаунта, оплаты, поддержки и аудита.
- Опубликовать privacy policy с перечнем данных и сроками хранения.
- Определить срок хранения закрытых обращений и истёкших сессий.
- Не хранить raw initData после успешной проверки.
- Не хранить полные Stripe и Telegram webhook bodies дольше, чем требуется для диагностики и дедупликации.
- Предусмотреть ручное удаление или анонимизацию профиля без уничтожения обязательной финансовой истории.

## 18. Конфигурация

Обязательные переменные .env.example:

| Переменная | Назначение |
| --- | --- |
| APP_BASE_URL | Публичный HTTPS URL Mini App |
| PUBLIC_TELEGRAM_BOT_USERNAME | Username бота, не секрет |
| TELEGRAM_BOT_TOKEN | Bot API token |
| TELEGRAM_WEBHOOK_SECRET | Проверка webhook |
| STRIPE_SECRET_KEY | Только test secret key с префиксом sk_test_ |
| STRIPE_WEBHOOK_SECRET | Подпись Stripe webhook |
| STRIPE_API_VERSION | Зафиксированная версия Stripe API |
| PAYMENT_CURRENCY | Валюта тарифов, default eur |
| STRIPE_LIVEMODE_ALLOWED | Всегда false для учебного проекта |
| ADMIN_TELEGRAM_CHAT_ID | Telegram user/private chat ID администратора |
| SUPPORT_CHAT_ID | Опциональная цель обращений |
| DATABASE_URL | Путь к SQLite в volume |
| SESSION_SECRET | Ключ сессий |
| DATA_ENCRYPTION_KEY | Шифрование subscription URL |
| MARZBAN_BASE_URL | Внутренний URL API |
| MARZBAN_ADMIN_USERNAME | Технический пользователь Marzban |
| MARZBAN_ADMIN_PASSWORD | Пароль Marzban |
| MARZBAN_VLESS_INBOUND_TAGS | Разрешённые inbound tags |
| SUBSCRIPTION_PUBLIC_BASE_URL | Публичный subscription host |
| LOG_LEVEL | Уровень логов |
| NODE_ENV | Окружение |

Config module валидирует все обязательные переменные при старте. Приложение завершается с понятной ошибкой при отсутствии или неверном формате конфигурации, не выводя значение секрета. Ключ sk_live_ или Stripe event с livemode = true должен отклоняться. Поскольку используется redirect на URL Checkout Session, publishable key в браузере для MVP не требуется.

## 19. Фоновые задачи

Worker использует таблицу jobs как минимальную надёжную очередь для одного VPS.

### 19.1. Общие правила

- payload каждого типа имеет версионированную runtime-схему;
- каждая job имеет уникальный idempotency_key;
- worker атомарно блокирует одну доступную job;
- зависшая processing job возвращается в pending после lock timeout;
- retry: exponential backoff с jitter;
- permanent validation error не повторяется;
- временная сеть, timeout и 5xx повторяются;
- последняя ошибка хранится как безопасный code, не raw secret;
- ручной retry создаёт audit event;
- остановка worker обрабатывает SIGTERM и не берёт новую job.

### 19.2. Контракты job

| Тип | Payload | Idempotency key |
| --- | --- | --- |
| vpn.provision.v1 | orderId | vpn.provision:<orderId> |
| support.notify.v1 | ticketId | support.notify:<ticketId> |
| vpn.reconcile.v1 | batch/date cursor | vpn.reconcile:<period> |

Для каждого handler обязателен тест двойного запуска с одним payload и проверкой, что внешний эффект выполнен один раз.

## 20. Ошибки и пользовательские состояния

UI должен различать:

- initial loading;
- open outside Telegram;
- authentication failed;
- empty plans;
- invalid или expired promo;
- checkout cancelled;
- payment confirmed;
- provisioning pending;
- active subscription;
- provisioning error;
- Marzban temporarily unavailable;
- support submitted;
- support notification pending;
- no purchase history;
- offline/retry.

Нельзя показывать пользователю внутренние exception messages. Для каждой ошибки задаётся стабильный code, понятный текст и допустимое действие: retry, открыть поддержку или вернуться на Главную.

## 21. Логирование и наблюдаемость

- Структурированные JSON logs.
- Поля: timestamp, level, service, requestId, userIdInternal, event, durationMs, errorCode.
- Не логировать bot token, Stripe keys/signatures, initData, cookies, Marzban password/token, subscription URL, VLESS UUID и полный support message.
- Health endpoints разделены на liveness и readiness.
- Critical alerts: webhook errors, payment without provision, exhausted job, backup failure, Marzban unavailable.
- Администратор получает техническое Telegram-уведомление без секретов.
- Для MVP допустимы логи Docker и Telegram alerts; внешняя observability подключается отдельным решением.

## 22. Резервные копии и восстановление

- Ежедневная online backup SQLite через SQLite backup API или безопасную команду backup, а не простое копирование активного WAL-файла.
- Отдельная резервная копия данных Marzban по его официальной процедуре.
- Копии шифруются и отправляются вне VPS.
- Retention: 7 ежедневных и 4 еженедельных копии как стартовая политика.
- Не реже одного раза в месяц выполняется тест восстановления.
- Документируется порядок восстановления app DB, encryption key, Marzban и DNS/TLS.
- Потеря DATA_ENCRYPTION_KEY делает сохранённые subscription URL нечитаемыми, поэтому ключ резервируется отдельно и безопасно.

Один VPS остаётся единой точкой отказа. Резервная копия на том же VPS не считается достаточной.

## 23. Тестирование

Тесты выводятся из критериев приёмки, а не из текущей реализации.

### 23.1. Unit

- Telegram initData signature и auth_date;
- расчёт скидки;
- лимиты и даты промокода;
- snapshot цены;
- правило продления;
- нормализация статусов Marzban;
- state machine заказа и подписки;
- проверка currency и amount_total Stripe session относительно order snapshot;
- redaction секретов;
- генерация стабильного marzban_username.

### 23.2. Property-based

- скидка никогда не делает total отрицательным;
- total равен base минус discount;
- продление никогда не сокращает срок;
- одинаковый payment event не увеличивает срок дважды;
- нормализация промокода идемпотентна.

### 23.3. Integration

- Drizzle repositories на отдельной временной SQLite;
- foreign keys и unique constraints;
- транзакция обработки checkout.session.completed;
- проверка Stripe webhook signature на raw request body;
- дедупликация Stripe event ID;
- повторная доставка одного checkout.session.completed;
- конкурентное применение лимитированного промокода;
- fake Stripe client;
- fake Telegram Bot API;
- fake Marzban API;
- retry, timeout, 401 и 5xx;
- двойной запуск каждого job handler.

### 23.4. End-to-end

- auth через mocked Telegram bridge;
- свайп и кнопки трёх секций;
- применение промокода;
- создание Stripe Checkout Session;
- возврат на success page без преждевременной активации;
- тестовый Stripe webhook и появление active subscription;
- отмена Stripe Checkout;
- QR и copy link;
- support form;
- admin visibility и server guard;
- CRUD тарифов и промокодов;
- dark/light theme и mobile viewport.

### 23.5. Security checks

- поддельный initData отклоняется;
- устаревший initData отклоняется;
- обычный пользователь получает 403 на admin endpoint;
- пользователь не может получить чужой order/subscription;
- изменённая клиентом цена игнорируется;
- повторный Stripe webhook не создаёт эффект;
- Stripe webhook с неверной подписью отклоняется;
- Stripe event с livemode = true отклоняется;
- запуск с live API key отклоняется;
- Telegram webhook без secret token отклоняется;
- logs не содержат заданные canary secrets.

## 24. Definition of Done

Задача считается завершённой, если:

- критерии приёмки выполнены;
- написаны тесты из критериев приёмки;
- eslint, prettier, svelte-check, unit/integration tests и build проходят;
- для нового внешнего контракта есть fake и contract test;
- для job есть тест идемпотентности и error path;
- миграция проверена на чистой БД и на копии предыдущей схемы;
- UI проверен в Telegram WebView-подобном mobile viewport;
- нет секретов и персональных данных в diff и логах;
- документация и .env.example обновлены;
- коммиты соответствуют правилам раздела 25;
- PR принят тимлидом.

## 25. Правила кода, комментариев и Git

### 25.1. Код

- TypeScript strict mode.
- Без any, кроме локально обоснованной интеграционной границы с последующей runtime validation.
- Security, OOP, SOLID и DRY применяются прагматично.
- Не смешивать SQL, HTTP и UI в одном модуле.
- Зависимости на Telegram и Marzban направлены через интерфейсы.
- Чистые функции предпочтительны для расчётов.
- Ошибки имеют стабильные typed codes.
- Экспортировать минимально необходимый публичный API модуля.
- Не делать преждевременную универсальную abstraction.

### 25.2. Язык

- Имена кода: только English.
- Комментарии в коде: только English.
- Commit messages: только English.
- Названия и описания PR: только English.
- Пользовательский UI локализуется отдельно и может быть русским, украинским или английским.

### 25.3. Комментарии

- Короткие и по делу.
- Объясняют почему, а не пересказывают код.
- Не оставлять закомментированный код.
- Не добавлять шаблонные комментарии к очевидным операциям.
- TODO содержит issue ID и конкретное условие удаления.

### 25.4. Коммиты

Git identity:

    user.name = heeavens heeavens
    user.email = savchenkohman@gmail.com

Формат Conventional Commits:

    type(scope): imperative summary

Разрешённые type:

- feat;
- fix;
- test;
- refactor;
- chore;
- docs.

Правила:

- summary в нижнем регистре, без точки, желательно до 50 символов;
- маленький логический commit после завершённого шага;
- по возможности каждый commit проходит typecheck;
- body используется только для объяснения причины;
- запрещены подписи, trailers, Co-authored-by или формулировки, указывающие на участие генеративной системы;
- нельзя переписывать авторство чужих коммитов;
- перед commit проверить staged diff на secrets и случайные файлы.

Примеры:

    feat(auth): verify telegram init data
    feat(payments): process stripe checkout
    fix(vpn): prevent duplicate extension
    test(promos): cover expired reservation

## 26. Процесс одного разработчика и тимлида

Тяжёлый командный процесс не нужен. Используется одна версия технического ядра и короткие вертикальные задачи.

### Тимлид

- утверждает это ТЗ и изменения общих контрактов;
- владеет архитектурными решениями, схемой БД, общими типами и инфраструктурой;
- проверяет security-sensitive код, платежи и Marzban;
- принимает миграции;
- выполняет review каждого PR;
- обновляет version и changelog ТЗ при изменении контракта.

### Разработчик

- реализует один вертикальный slice за один PR;
- не выдумывает отсутствующий контракт;
- при пробеле создаёт блок CONTRACT GAP: что отсутствует, зачем нужно, предлагаемая форма и затронутые части;
- может продолжить независимую работу через fake, но не фиксирует новый общий контракт без тимлида;
- добавляет тесты в том же PR;
- обновляет документацию вместе с кодом.

### Минимальный workflow

1. Issue с критериями приёмки.
2. Короткая feature branch.
3. Маленькие Conventional Commits.
4. PR с кратким описанием, контрактами, миграциями и тестами.
5. Автоматический CI.
6. Review тимлида.
7. Merge в main.
8. Автодеплой на staging.
9. Smoke test.
10. Ручное продвижение в production до стабилизации проекта.

Даже при одном разработчике main защищается от прямого push. Общие файлы schema, types, config, auth, payments и Marzban требуют явного review тимлида.

## 27. CI/CD

### PR gate

- install по lock-файлу;
- prettier check;
- eslint;
- svelte-check;
- unit и integration tests;
- production build;
- Drizzle migrations на чистой SQLite;
- Playwright smoke для затронутого критического пути;
- dependency и secret scan;
- Docker image build без deploy.

### Merge в main

- сборка immutable image с commit SHA;
- backup перед migration;
- запуск migration service;
- запуск app и worker;
- healthcheck;
- smoke test Telegram auth mock, DB и Marzban health;
- сохранение предыдущего image для rollback.

Миграции должны быть backward-compatible с предыдущей версией приложения на время rolling restart. Для SQLite deployment выполняется последовательно, чтобы не запускать две версии, меняющие схему одновременно.

## 28. Этапы реализации

### Этап 0. Решения и инфраструктурные доступы

- подтвердить способ продления;
- определить домены;
- создать Telegram-бота и Mini App;
- получить bot token;
- определить admin ID;
- создать Stripe sandbox, получить test keys и настроить Stripe CLI;
- настроить test webhook endpoint;
- определить VLESS inbound tags;
- подготовить VPS, DNS и firewall;
- утвердить тексты terms, privacy и refunds.

### Этап 1. Скелет

- SvelteKit, Tailwind, Drizzle, SQLite;
- Docker Compose, Caddy, app и worker;
- config validation и .env.example;
- schema и migrations;
- UI primitives и kitchen-sink page;
- fake Telegram и fake Marzban;
- CI;
- health endpoints;
- одна эталонная вертикаль.

Чек-лист готовности скелета:

- CI зелёный;
- layout, auth guard и навигация работают;
- UI primitives отрисованы;
- migration проходит на чистой БД;
- worker выполняет demo job;
- fake clients возвращают fixtures;
- staging deployment здоров;
- один end-to-end smoke test проходит.

### Этап 2. Telegram auth и базовый UI

- initData verification;
- session management;
- user upsert;
- AppShell;
- три секции, свайп и glass navigation;
- профиль пользователя.

### Этап 3. Каталог и админка

- планы;
- seed 7/30/90;
- admin guard;
- CRUD и soft delete тарифов;
- промокоды;
- FAQ;
- audit log.

### Этап 4. Оплата и VPN

- orders и reservation;
- Stripe Checkout Session;
- success и cancel pages;
- Stripe webhook signature verification;
- checkout.session.completed;
- webhook idempotency;
- durable provisioning job;
- Marzban client;
- profile subscription, QR и history;
- reconciliation.

### Этап 5. Поддержка

- FAQ;
- support form;
- durable admin notification;
- ticket list и statuses;
- /support и /paysupport.

### Этап 6. Hardening и production

- threat review;
- rate limits и headers;
- backup/restore test;
- load and failure tests;
- operational runbook;
- production deployment;
- smoke test на реальном Telegram client.

## 29. Критерии приёмки MVP

1. Новый Telegram-пользователь открывает Mini App и видит Главную.
2. Поддельный или устаревший initData не создаёт сессию.
3. Между Поддержкой, Главной и Профилем можно перейти свайпом и кнопками.
4. Начальные тарифы 7, 30 и 90 дней появляются после установки цен и активации.
5. Администратор может создать, изменить, отключить и архивировать тариф.
6. Обычный пользователь не видит админку и получает 403 при прямом запросе.
7. Действующий промокод корректно меняет серверную цену.
8. Истёкший, выключенный или исчерпанный промокод отклоняется.
9. Успешная тестовая оплата Stripe создаёт ровно одну payment record.
10. Повтор одного Stripe event не создаёт повторное продление.
11. После оплаты Marzban создаёт или продлевает VLESS-пользователя.
12. Временная ошибка Marzban не теряет оплату и приводит к retry.
13. Профиль показывает актуальную дату окончания, QR и subscription URL.
14. Пользователь видит только свою историю.
15. Обращение сохраняется до вызова Telegram Bot API.
16. При временной ошибке Bot API уведомление повторяется.
17. Администратор получает обращение в личный чат и видит его в админке.
18. Логи не содержат секреты и VPN-ссылки.
19. Резервная копия обеих БД создаётся вне VPS и успешно восстанавливается на тестовом окружении.
20. Все проверки Definition of Done проходят.

## 30. Вопросы, которые нужно закрыть до разработки соответствующего этапа

| Вопрос | Предлагаемое значение по умолчанию | Блокирует |
| --- | --- | --- |
| Какой домен и поддомены использовать? | app, sub, panel | Production TLS |
| Какой transport и inbound VLESS использовать? | Настроить вручную в Marzban | Marzban integration |
| VPN безлимитный или с traffic quota? | Безлимитный по трафику, ограничение по дате | Plan contract |
| Как продлевать активную подписку? | Добавлять дни к текущему expiry | Payments |
| Что делать при refund? | Помечать заказ refunded и пересчитывать/отзывать оставшийся доступ вручную в MVP | Refund policy |
| Какие языки UI нужны? | English first, локализация отдельной задачей | UI copy |
| Нужна ли поддержка вне Mini App? | Только команды бота и Mini App | Bot scope |
| Нужен ли ответ поддержки внутри приложения? | Нет в MVP | Support scope |
| SUPPORT_CHAT_ID отличается от admin ID? | Нет | Support deployment |
| Какие лимиты на обращения? | 3 за 10 минут, затем cooldown | Abuse protection |
| Как долго хранить closed tickets? | 12 месяцев | Privacy policy |
| Как открывать Stripe Checkout из Mini App? | Redirect на Stripe-hosted page с возвратом на success_url | Payment UX |

## 31. Основные риски

- Один VPS является единой точкой отказа.
- VPN-трафик и приложение конкурируют за CPU, RAM, сеть и file I/O.
- Компрометация bot token позволяет подделывать доверенный Telegram-контур.
- SQLite подходит для одного app instance и умеренного числа записей, но требует коротких транзакций и контроля конкуренции.
- Внешняя доступность Marzban, Stripe API и Telegram Bot API не гарантируется.
- Subscription URL является credential: его утечка равна утечке VPN-доступа.
- Stripe API и webhook contracts зависят от зафиксированной API version; обновление версии требует повторного запуска contract tests.
- Реальный capacity VPS определяется нагрузочным тестом. Стартовая конфигурация 2 vCPU и 2–4 GB RAM является только ориентиром, а не гарантией.

## 32. Runbook перед запуском

- Проверить DNS и TLS.
- Проверить, что panel и Marzban API не открыты публично.
- Проверить firewall и только необходимые Xray inbound ports.
- Проверить bot token, Telegram webhook secret и Stripe test keys.
- Проверить admin ID и тестовое обращение.
- Проверить Stripe Checkout успешной, отменённой и отклонённой тестовыми картами.
- Проверить, что live Stripe key и livemode event отклоняются.
- Проверить создание, продление и истечение VLESS user.
- Проверить QR на iOS, Android и Telegram Desktop.
- Проверить темную и светлую темы.
- Проверить backup и restore.
- Проверить redaction логов.
- Проверить alert на failed provisioning.
- Проверить /terms, /privacy, /support и /paysupport.
- Зафиксировать версии Docker images и сохранить rollback image.
