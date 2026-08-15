# Stages 1–2 test plan

## Acceptance coverage

| Behaviour                                                    | Test level           | Required evidence                                                                          |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| Configuration rejects missing values and Stripe live keys    | Unit                 | Valid fixture passes; invalid and `sk_live_` fixtures fail without secret values in errors |
| Telegram identity is authentic and fresh                     | Unit                 | Valid, forged, expired, future, and malformed `initData` cases                             |
| Authentication upserts a user and stores only a session hash | Integration          | Re-authentication updates one user; raw token is absent from SQLite                        |
| Auth HTTP contract rejects unsafe input and revokes logout   | E2E HTTP/browser     | 204 handshake/logout; typed 4xx errors; no writes for forged or expired initData           |
| Protected layout and profile are session scoped              | Integration/E2E      | Anonymous and expired sessions redirect; profile contains only its public DTO              |
| Schema migrates on an empty database                         | Integration/CI       | Migration script plus foreign-key and unique-constraint checks                             |
| Worker removes expired sessions regularly                    | Integration          | Cleanup runs at startup and hourly, stops cleanly, and removes only expired rows           |
| Fake Telegram and Marzban adapters honour their contracts    | Contract integration | Deterministic fixtures and normalized failures                                             |
| UI primitives render                                         | E2E kitchen sink     | Buttons, fields, cards, badges, feedback and loading states are visible                    |
| Three sections navigate by button and swipe                  | E2E mobile           | Buttons, both swipe directions, thresholds, bounds, focus and scroll retention             |
| AppShell follows Telegram lifecycle and theme                | E2E mobile           | Returning sessions call ready/expand and react to Telegram theme changes                   |
| Profile handles Telegram data variants                       | E2E mobile           | Optional names, admin visibility, neutral avatar and failed-photo fallback                 |
| Liveness and readiness are distinct                          | Integration/E2E      | Live succeeds without a database query; ready succeeds after migration                     |
| Production bundle and container image compile                | CI                   | SvelteKit, worker and Docker build jobs                                                    |

## Coverage targets

- Every Telegram signature/freshness rejection and config safety branch has a focused unit case.
- Repository integration coverage for user upsert, session expiry, hash lookup, and constraints.
- Chromium mobile flows cover the Telegram bridge handshake, logout, auth guard,
  expired-session cookie clearing, Telegram lifecycle and theme, pager boundaries, reduced
  motion, and profile variants.
- Component rendering is covered through the kitchen-sink smoke page; pixel-perfect visual
  regression is deferred until the design baseline is approved.

## Known external gaps

- Fake Telegram Bot API and Marzban adapters wait for their DTO and normalized-error contracts to be approved; real adapter contract tests will additionally need sandbox credentials and reachable services.
- CD and a staging server are intentionally excluded from this stage; Compose runtime verification waits for a Docker-capable deployment environment.
- Safari/iOS Telegram WebView validation remains a manual staging check.
- This is the initial migration, so there is no previous schema fixture yet; every subsequent migration must test both clean and previous schemas.
