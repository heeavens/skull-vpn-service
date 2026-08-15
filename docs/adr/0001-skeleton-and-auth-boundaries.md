# ADR-0001: Skeleton and authentication boundaries

- **Status:** Proposed
- **Date:** 2026-08-15
- **Deciders:** Team lead

## Context

The first two delivery stages require a deployable SvelteKit application, a separate durable worker, SQLite persistence, Telegram Mini App authentication, and replaceable Telegram and Marzban integrations on one VPS. The technical specification fixes the shared routes, data model, and security rules.

## Decision

Use one SvelteKit adapter-node image for HTTP traffic and one separately bundled Node.js worker process. Both use the application SQLite database only through repositories. Telegram authentication is a server-side boundary: the endpoint accepts raw `initData`, verifies its HMAC and freshness, upserts the user, and creates an opaque session whose SHA-256 hash is stored. External APIs are hidden behind server-side interfaces with real and fake adapters.

The protected application is one vertical profile slice: verified Telegram identity, session lookup in the server hook, guarded server layout, public user DTO, and three-section AppShell. Migrations run once before app and worker startup.

## Options Considered

### One SvelteKit service plus a separate worker

| Dimension        | Assessment                                  |
| ---------------- | ------------------------------------------- |
| Complexity       | Medium                                      |
| Cost             | Low; one image and one VPS                  |
| Scalability      | Appropriate for one app instance and SQLite |
| Team familiarity | Uses the required stack                     |

- **Pros:** Clear HTTP/job isolation, shared domain code, deterministic migration ordering.
- **Cons:** App and worker still share a single SQLite contention boundary.

### Process jobs inside SvelteKit requests

| Dimension        | Assessment                                  |
| ---------------- | ------------------------------------------- |
| Complexity       | Low initially                               |
| Cost             | Low                                         |
| Scalability      | Poor for retries and long external calls    |
| Team familiarity | Simple but conflicts with the specification |

- **Pros:** Fewer processes.
- **Cons:** Request lifecycle can lose work, graceful retries are harder, and Marzban calls would couple provisioning to HTTP.

## Trade-off Analysis

The separate worker adds a build entry point and deployment service, but it preserves durable work and keeps external calls out of database transactions. SQLite remains suitable only while the deployment stays single-instance with short transactions and configured busy timeouts.

## Consequences

- Authentication, secrets, database rows, and external responses stay server-side.
- The UI depends only on public DTOs.
- Deployment must run migrations before app and worker.
- Schema, auth, config, migrations, and infrastructure require team lead review.
- Horizontal app scaling requires a future storage/queue decision.

## Action Items

1. [ ] Team lead reviews this ADR and the initial migration.
2. [ ] Run the Compose health smoke when VPS deployment enters scope.
3. [ ] Revisit storage before introducing a second app instance.
