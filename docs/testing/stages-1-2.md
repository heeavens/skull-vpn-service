# Stages 1–2 test plan

## Acceptance coverage

| Behaviour                                                    | Test level           | Required evidence                                                                          |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| Configuration rejects missing values and Stripe live keys    | Unit                 | Valid fixture passes; invalid and `sk_live_` fixtures fail without secret values in errors |
| Telegram identity is authentic and fresh                     | Unit                 | Valid, forged, expired, future, and malformed `initData` cases                             |
| Authentication upserts a user and stores only a session hash | Integration          | Re-authentication updates one user; raw token is absent from SQLite                        |
| Protected layout and profile are session scoped              | Integration/E2E      | Anonymous request is redirected; authenticated profile contains only its public DTO        |
| Schema migrates on an empty database                         | Integration/CI       | Migration script plus foreign-key and unique-constraint checks                             |
| Worker demo path completes and stops                         | Integration          | One demo execution reports one successful external effect                                  |
| Fake Telegram and Marzban adapters honour their contracts    | Contract integration | Deterministic fixtures and normalized failures                                             |
| UI primitives render                                         | E2E kitchen sink     | Buttons, fields, cards, badges, feedback and loading states are visible                    |
| Three sections navigate by button and swipe                  | E2E mobile           | Default Home, nav changes, horizontal-dominant swipe changes section                       |
| Liveness and readiness are distinct                          | Integration/E2E      | Live succeeds without a database query; ready succeeds after migration                     |
| Production bundle and container image compile                | CI                   | SvelteKit, worker and Docker build jobs                                                    |

## Coverage targets

- Every Telegram signature/freshness rejection and config safety branch has a focused unit case.
- Repository integration coverage for user upsert, session expiry, hash lookup, and constraints.
- One Chromium mobile smoke flow for the auth guard and a seeded session through the profile screen.
- Component rendering is covered through the kitchen-sink smoke page; pixel-perfect visual regression is deferred until the design baseline is approved.

## Known external gaps

- The HTTP Telegram handshake and its forged/expired request cases wait for the auth response, error, body-limit, cookie and rate-limit contract to be approved.
- Fake Telegram Bot API and Marzban adapters wait for their DTO and normalized-error contracts to be approved; real adapter contract tests will additionally need sandbox credentials and reachable services.
- CD and a staging server are intentionally excluded from this stage; Compose runtime verification waits for a Docker-capable deployment environment.
- Safari/iOS Telegram WebView validation remains a manual staging check.
- This is the initial migration, so there is no previous schema fixture yet; every subsequent migration must test both clean and previous schemas.
