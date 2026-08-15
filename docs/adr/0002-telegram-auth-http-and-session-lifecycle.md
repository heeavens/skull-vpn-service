# ADR-0002: Telegram auth HTTP and session lifecycle

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Team lead

## Context

The specification fixes the Telegram verification algorithm, the two auth routes, the session
cookie attributes, and the seven-day lifetime. It does not yet define the HTTP request and
response details, stable auth error codes, input and rate limits, logout semantics, or the worker
cadence for expired-session cleanup. Those values are shared security contracts and cannot be
introduced by the implementation alone.

Stage 2 can complete its AppShell and profile work independently, but the browser authentication
flow and regular session cleanup remain blocked until this proposal is accepted and copied into
`tech.md` with a version and changelog entry.

## Decision

Use the following contract:

- `POST /api/auth/telegram` accepts the unmodified `Telegram.WebApp.initData` as a UTF-8
  `text/plain` body with a 16 KiB maximum. It never accepts `initDataUnsafe` or a client user DTO.
- A successful handshake returns `204 No Content`, sets the required seven-day session cookie,
  and does not return user or session data in JSON.
- Invalid and expired init data both return `401`; their stable codes are
  `TELEGRAM_INIT_DATA_INVALID` and `TELEGRAM_INIT_DATA_EXPIRED`. The UI may show the same safe
  recovery message for both.
- Unsupported media type returns `415` with `REQUEST_CONTENT_TYPE_INVALID`; an oversized body
  returns `413` with `REQUEST_BODY_TOO_LARGE`; throttling returns `429` with
  `AUTH_RATE_LIMITED` and `Retry-After`.
- Every error uses the existing error envelope and request ID. Auth responses never echo or log
  init data, hashes, cookies, Telegram profile fields, or bot-token-derived material.
- The auth endpoint permits ten attempts per client address in a rolling minute and five
  successful session creations per verified Telegram user in five minutes. Counters may be
  process-local for the approved single-instance deployment.
- Client address resolution trusts exactly one `X-Forwarded-For` hop from the internal Caddy
  service. The app container remains unreachable from the public network. Set adapter-node's
  `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1`; add both values to the protected
  configuration contract and `.env.example`.
- `POST /api/auth/logout` requires same-origin `Origin`, is idempotent, always clears the cookie,
  deletes the matching server session when present, and returns `204 No Content`. It does not
  reveal whether a supplied token existed. A mismatched or missing origin returns `403` with
  `REQUEST_ORIGIN_INVALID` without changing the session.
- `AuthenticatedUser` is a server principal containing the internal user ID, validated Telegram
  user ID, current Telegram profile fields, and `isAdmin`. Routes serialize a separate minimal
  profile view model and never return the principal wholesale.
- Expired sessions are worker housekeeping rather than a new durable job type. The worker deletes
  expired rows on startup and once per hour, logs only the deletion count, and stops the timer and
  closes SQLite on `SIGTERM`.

## Options Considered

### Plain-text handshake with an empty success response

| Dimension     | Assessment                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Complexity    | Low                                                                        |
| Security      | Keeps the raw signed string intact and minimizes response data             |
| Compatibility | Matches the existing Mini App client flow                                  |
| Testability   | HTTP status, cookie, database effect, and error envelope are deterministic |

**Pros:** No duplicate user DTO, no JSON re-serialization of signed data, and a small public
surface.

**Cons:** The browser must reload protected server data after authentication.

### JSON handshake request and response

| Dimension     | Assessment                                     |
| ------------- | ---------------------------------------------- |
| Complexity    | Medium                                         |
| Security      | Adds an unnecessary parser and public DTO      |
| Compatibility | Requires changing the existing client          |
| Testability   | Explicit, but duplicates protected layout data |

**Pros:** A conventional JSON API can return the user immediately.

**Cons:** It expands the shared contract without a product need and makes it easier to accidentally
trust client-shaped Telegram data.

### Durable cleanup job

| Dimension       | Assessment                                                |
| --------------- | --------------------------------------------------------- |
| Complexity      | Medium                                                    |
| Reliability     | Durable scheduling and retry history                      |
| Contract impact | Adds an unapproved job type, payload, and idempotency key |
| MVP fit         | Disproportionate for deleting expired local rows          |

**Pros:** Cleanup execution is observable and recoverable.

**Cons:** It introduces a new shared job contract for a safe, repeatable local maintenance query.

## Trade-off Analysis

Plain text preserves Telegram's signed payload exactly while the `204` response keeps identity
loading on the existing protected server boundary. Separate per-address and per-user limits cover
forged request floods and replay-driven session creation, but require an explicit trusted-proxy
deployment contract. Hourly worker housekeeping satisfies regular cleanup without polluting the
durable business-job taxonomy.

## Consequences

- Auth route tests can assert exact status codes, stable error codes, cookies, database effects,
  body limits, rate limits, origin checks, and secret redaction.
- The Mini App can complete a mocked Telegram bridge to cookie to Home end-to-end test.
- `ADDRESS_HEADER` and `XFF_DEPTH` become protected environment configuration.
- Process-local counters are acceptable only while the app remains single-instance.
- Changing limits or response codes later requires a contract version and changelog update.

## Action Items

1. [x] Team lead accepts the proposed values.
2. [x] Update the `tech.md` version, changelog, endpoint table, error codes, limits, proxy settings,
       and session-cleanup rules.
3. [x] Implement both auth routes, limits, cleanup, and acceptance-derived tests.
4. [x] Complete security review before merge.
