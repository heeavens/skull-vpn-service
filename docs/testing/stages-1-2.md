# Stages 1–2 test plan

## Acceptance coverage

| Behaviour                                                    | Test level           | Required evidence                                                                          |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| Configuration rejects missing values and Stripe live keys    | Unit                 | Valid fixture passes; invalid and `sk_live_` fixtures fail without secret values in errors |
| Telegram identity is authentic and fresh                     | Unit                 | Valid, forged, expired, future, and malformed `initData` cases                             |
| Authentication upserts a user and stores only a session hash | Integration          | Re-authentication updates one user; raw token is absent from SQLite                        |
| Protected layout and profile are session scoped              | Integration/E2E      | Anonymous and expired sessions redirect; profile contains only its public DTO              |
| Schema migrates on an empty database                         | Integration/CI       | Migration script plus foreign-key and unique-constraint checks                             |
| Worker demo path completes and stops                         | Integration          | One demo execution reports one successful external effect                                  |
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
- Chromium mobile flows cover the auth guard, expired-session cookie clearing, a seeded session,
  Telegram lifecycle and theme, all pager boundaries, reduced motion, and profile variants.
- Component rendering is covered through the kitchen-sink smoke page; pixel-perfect visual regression is deferred until the design baseline is approved.

## Known external gaps

- The HTTP Telegram handshake, logout, regular expired-session cleanup, and their acceptance tests
  wait for the contract in ADR-0002 to be approved and added to `tech.md`.
- Fake Telegram Bot API and Marzban adapters wait for their DTO and normalized-error contracts to be approved; real adapter contract tests will additionally need sandbox credentials and reachable services.
- CD and a staging server are intentionally excluded from this stage; Compose runtime verification waits for a Docker-capable deployment environment.
- Safari/iOS Telegram WebView validation remains a manual staging check.
- This is the initial migration, so there is no previous schema fixture yet; every subsequent migration must test both clean and previous schemas.
