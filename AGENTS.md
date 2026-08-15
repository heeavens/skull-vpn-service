# Project Instructions

This file contains the mandatory day-to-day engineering rules for the VPN Telegram Mini App project.

## Source of truth

1. Read tech.md before planning or editing code.
2. If tech.md has not yet been created under that name, read vpn-telegram-mini-app-tech-spec.md instead.
3. Do not keep both specification files as independent copies. tech.md is the canonical repository name.
4. The full specification overrides this summary.
5. Do not invent a missing database field, shared type, API contract, job payload, status, route, or environment variable.
6. Changes to shared contracts require team lead approval and a version/changelog update in tech.md.

If a required contract is missing, stop the dependent implementation and report:

    CONTRACT GAP
    Needed:
    Reason:
    Proposed contract:
    Affected files and features:

Independent work may continue against an existing fake. Do not silently turn the proposal into a shared contract.

## Project scope

- Team: one developer and one team lead.
- Application: Telegram Mini App for purchasing and managing VLESS VPN access.
- Core stack: SvelteKit, Svelte 5, TypeScript, Tailwind CSS, SQLite, Drizzle ORM, Docker, Marzban, Xray/VLESS.
- Payments: Stripe Checkout in test mode only.
- Deployment: one VPS with separate app, worker, Marzban, Xray, reverse proxy, and persistent volumes.

## Task workflow

1. Implement one vertical slice at a time.
2. Derive tests from acceptance criteria before relying on implementation details.
3. Keep the diff focused on the current issue.
4. Reuse established patterns and UI primitives.
5. Update tests, documentation, migrations, and .env.example in the same PR when affected.
6. Do not refactor unrelated code.
7. Do not modify shared contracts merely to make a local implementation easier.
8. Ask for team lead review for schema, shared types, config, auth, payments, Marzban, migrations, and infrastructure.

## Architecture rules

- Organize code by vertical feature slices, not by separate frontend and backend projects.
- Keep route handlers thin: authenticate, authorize, validate, invoke a use case, map the result.
- Keep business rules in domain services or pure functions.
- Access SQLite only through repositories.
- Access Stripe, Telegram, and Marzban only through server-side adapters.
- Provide real and fake implementations for every external client.
- UI components receive public DTOs or view models, never raw database rows or external API responses.
- Do not mix SQL, HTTP, external API calls, and UI logic in one module.
- Use interfaces and dependency injection at real boundaries.
- Use classes for stateful services and adapters. Keep calculations as pure functions.
- Apply DRY to stable repetition. Do not create speculative generic abstractions.
- Export the smallest useful public module API.

## SvelteKit and Svelte rules

### Runes

- Use $state only for values that must trigger reactive UI updates.
- Use $derived for computed state.
- Keep $derived free of side effects.
- Use $effect only for external side effects such as Telegram WebApp integration, scroll synchronization, and event listeners.
- Do not use $effect to calculate values that belong in $derived.
- Put reusable rune-based state in .svelte.ts files.
- Do not replace every normal variable with $state.

### Server and client boundaries

- Put database code, secrets, cryptography, Stripe, Telegram verification, and Marzban clients in src/lib/server or .server.ts files.
- Import secrets only through private environment modules.
- Never expose bot tokens, Stripe secrets, webhook secrets, Marzban credentials, encryption keys, or raw subscription URLs to the browser.
- Never store request-specific or user-specific state in server module globals. A Node.js process serves multiple users.
- Return minimal public DTOs to the client.

### Data loading and mutations

- Use +page.server.ts and +layout.server.ts for protected server data.
- Use server form actions with use:enhance for application forms.
- Use +server.ts for Stripe and Telegram webhooks, the Telegram auth handshake, and genuine JSON APIs.
- Use generated PageServerLoad, Actions, and RequestHandler types.
- Do not use experimental remote functions in the MVP without an approved architecture change.

### Authorization

- hooks.server.ts resolves the session into event.locals.user.
- A layout may hide UI but is not a security boundary.
- Check authentication and authorization inside every protected server load, action, and endpoint.
- Filter user-owned records by the current internal user ID.
- Check admin access on the server by comparing the validated Telegram user ID with ADMIN_TELEGRAM_CHAT_ID.
- Never rely on a hidden admin button or client-provided Telegram identity.

## Validation and error handling

- Enable TypeScript strict mode.
- Avoid any. At an external boundary, validate unknown data before converting it to an internal type.
- Validate all request bodies, query parameters, webhook payloads, job payloads, and environment variables at runtime.
- Use stable typed error codes.
- Never return stack traces, SQL errors, raw Stripe errors, or Marzban responses to the user.
- Keep user-facing error messages actionable.
- Escape user content before using Telegram parse mode.
- Enforce input length limits and rate limits defined in tech.md.

## Telegram security

- Send raw Telegram.WebApp.initData to the server.
- Verify its signature with the bot token.
- Validate auth_date freshness.
- Never trust initDataUnsafe.
- Do not persist raw initData after successful verification.
- Store Telegram IDs as text.
- Store only a SHA-256 hash of each opaque session token.
- Use Secure, HttpOnly, SameSite=Lax cookies.
- Verify X-Telegram-Bot-Api-Secret-Token on the Telegram webhook.

## Stripe payment rules

- Stripe Checkout operates in test mode only.
- Reject STRIPE_SECRET_KEY values beginning with sk_live_.
- Reject Stripe events with livemode = true.
- Calculate plan price, discount, total, and currency on the server.
- Store amounts as integer minor units. For EUR, 1099 means €10.99.
- Parse admin-entered decimal prices without float arithmetic.
- Create Checkout Sessions with mode = payment and card payments only.
- Use an idempotency key derived from the internal order ID when creating a Checkout Session.
- Put the internal order ID in client_reference_id and metadata.
- Treat the Checkout URL as the only client-visible Stripe value required by the MVP.
- The success page is not proof of payment and must never activate VPN access.
- Verify Stripe-Signature against the raw request body and STRIPE_WEBHOOK_SECRET.
- Accept payment only after a valid checkout.session.completed event with payment_status = paid.
- Compare the Stripe session order reference, currency, and amount_total with the immutable order snapshot.
- Deduplicate every Stripe event by event ID.
- Enforce unique Checkout Session ID, Payment Intent ID, and one payment per order.
- Handle checkout.session.expired by cancelling the unpaid order and releasing its promo reservation.
- In one short SQLite transaction, record the payment, update the order, redeem the promo, and enqueue vpn.provision.
- Never call Stripe or Marzban while holding a SQLite transaction.
- Never log Stripe keys, signatures, raw webhook bodies, or sensitive payment objects.

## Marzban and VPN rules

- Use Marzban only through its REST API.
- Never read or modify the Marzban database directly.
- Keep the app database separate from Marzban data.
- Keep Marzban credentials and subscription URLs server-side.
- Generate a stable Marzban username from an internal cryptographic identifier, not from Telegram username.
- One Telegram user maps to one Marzban user and one current subscription URL.
- Restrict provisioning to approved VLESS inbound tags.
- Encrypt subscription URLs at rest with authenticated encryption.
- Redact subscription URLs and VLESS UUIDs from logs.
- Provision or extend access through the durable vpn.provision job.
- Extension rule: max(currentExpiry, paidAt) plus purchased duration.
- Processing the same order or payment twice must not extend access twice.
- Use timeout, bounded retry, exponential backoff, and safe error normalization.
- Reconcile local subscription state with Marzban periodically.

## SQLite and Drizzle rules

- Drizzle schema files define the database schema.
- Generate and commit Drizzle migrations.
- Apply migrations through one deployment step before app and worker start.
- Do not let app and worker run migrations concurrently.
- Enable foreign_keys, WAL mode, and busy_timeout in production-like environments.
- Store timestamps as UTC Unix milliseconds.
- Store monetary values as integer minor units.
- Use foreign keys, unique constraints, checks, and indexes from tech.md.
- Keep transactions short.
- Do not perform network calls inside database transactions.
- Make payment recording, promo redemption, and job creation atomic.
- Test migrations against a clean database and the previous schema.

## Durable jobs

- Validate every job payload using a versioned runtime schema.
- Give every job a unique idempotency key.
- Claim jobs atomically.
- Recover stale processing locks.
- Retry only temporary failures.
- Use exponential backoff with jitter.
- Store safe error codes, not raw secret-bearing responses.
- Gracefully stop the worker on SIGTERM.
- Every job handler requires a test that runs the same payload twice and proves one external effect.
- Every handler requires a temporary-failure and exhausted-retry test.

## Testing rules

- Derive tests from acceptance criteria, not from implementation structure.
- Add tests in the same PR as the feature.
- Unit test pure domain rules.
- Integration test repositories, transactions, constraints, adapters, and job handlers.
- Use FakeStripeClient, FakeTelegramBotClient, and FakeMarzbanClient.
- Use Playwright for critical user flows.

Mandatory payment and security coverage:

- forged and expired Telegram initData;
- non-admin access to admin endpoints;
- access to another user's order or subscription;
- client price tampering;
- Stripe signature verification using the raw body;
- live Stripe key and livemode event rejection;
- currency and amount mismatch;
- duplicate Stripe event;
- duplicate payment and duplicate provisioning job;
- promo usage race;
- Marzban timeout, 401, and 5xx;
- double execution of every job handler;
- secret redaction canary tests.

Property-based invariants:

- total equals base amount minus discount;
- total never becomes negative;
- renewal never shortens the subscription;
- the same payment never extends the subscription twice;
- promo normalization is idempotent.

## Code style

- Use clear English names.
- Keep functions and modules focused.
- Prefer explicit code over hidden magic.
- Comments must be short, in English, and explain why.
- Do not comment obvious code.
- Do not leave commented-out code.
- A TODO must include an issue ID and a concrete removal condition.
- Do not add filler comments, generated summaries, or unrelated documentation.

## Git rules

Set commit identity:

    git config user.name "heeavens heeavens"
    git config user.email "savchenkohman@gmail.com"

All commit messages, PR titles, PR descriptions, and code comments must be in English.

Use Conventional Commits:

    type(scope): imperative summary

Allowed types:

- feat
- fix
- test
- refactor
- chore
- docs

Commit rules:

- Use a lowercase imperative summary without a trailing period.
- Keep the summary close to 50 characters when practical.
- Make small logical commits during the task.
- Each commit should pass typecheck when practical.
- Use a body only to explain why.
- Do not add AI attribution, generated-by text, Co-authored-by trailers, or similar metadata.
- Do not rewrite another person's authorship.
- Review staged changes for secrets and unrelated files before committing.

Examples:

    feat(auth): verify telegram init data
    feat(payments): process stripe checkout
    fix(vpn): prevent duplicate extension
    test(promos): cover expired reservation

## Definition of Done

Before marking a task complete:

- acceptance criteria pass;
- tests were derived from those criteria;
- formatting passes;
- ESLint passes;
- svelte-check passes;
- unit and integration tests pass;
- the production build passes;
- relevant Playwright tests pass;
- external contract changes include a fake and contract test;
- job changes include idempotency and error-path tests;
- migrations pass on clean and previous schemas;
- .env.example and documentation are current;
- no secrets or personal data appear in the diff or logs;
- the diff contains no unrelated changes;
- the team lead reviewed protected contracts and security-sensitive changes.

Use the repository's actual package scripts. Do not invent command names when package.json already defines them.

Approach to code testing fixed by skill 'engineering:testing-strategy'. Review PR - 'engineering:code-review'. Contracts and slicing decisions teamlead making via 'engineering:archtecture' (ADR).
