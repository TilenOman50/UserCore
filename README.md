# UserCore

A self-hosted identity verification and compliance platform. UserCore lets a company define what its customers must go through to be onboarded — identity document checks, AML screening, fraud and duplicate detection — run those checks through third-party providers, and review the results in an admin dashboard.

Built end to end as a diploma project: seven backend services, an admin dashboard, an embeddable verification widget, and two demo integrations.

## What it does

- **Configurable onboarding workflows.** Define which verification steps run for your customers and which provider performs each one.
- **Declarative rule engine.** Compliance rules are recursive AND/OR condition trees stored as JSONB, so non-technical staff can change risk logic without a deploy. Evaluated trees are persisted, so a reviewer can see exactly which conditions fired.
- **Provider abstraction.** iDenfy (identity), ComplyAdvantage (AML screening) and IPQualityScore (fraud) sit behind a common interface, selected per workspace.
- **Verification widget.** Embeddable flow with client-side biometric liveness via MediaPipe, plus a mobile handoff so a desktop user can finish document capture on their phone.
- **Review queue.** Compliance staff approve, reject or request resubmission, with an append-only activity timeline per session.
- **Multi-tenant.** Organisations, workspaces, members, roles and per-workspace API keys.

## Architecture

Turborepo monorepo. Services communicate over REST and RabbitMQ events, each owning its own PostgreSQL schema.

| Service | Responsibility |
|---|---|
| `auth-api` | Authentication, organisations, workspaces, members, roles |
| `workflows-api` | Workflow definitions, sessions, KYC steps, documents |
| `identity-api` | Customer profiles and canonical identity data |
| `providers-api` | Third-party provider integrations and dispatch |
| `scenarios-api` | Scenario rule engine and alerts |
| `tms-api` | Transaction monitoring |
| `dashboard-api` | Aggregates and statistics for the dashboard |

| Frontend | Purpose |
|---|---|
| `dashboard` | Admin dashboard (React, Vite) |
| `widget` | Embeddable verification flow |
| `landing` | Marketing site |
| `mock-alpska-banka` | Demo integration: retail bank |
| `mock-workly` | Demo integration: freelance marketplace |

Both demo apps run against the same backend, showing multi-tenant use from two different host contexts.

## Stack

TypeScript · Bun · Hono · PostgreSQL with Drizzle ORM · RabbitMQ · React · Vite · Tailwind CSS · Zod · OpenAPI

## Testing

Integration tests run against **PGLite** — real PostgreSQL compiled to WASM — rather than mocks. Each test file gets a fresh in-memory database running the same migrations as production, so tests exercise real SQL, real constraints and real transactions. 187 tests complete in about 40 seconds and run on every push.

## Running locally

Requires [Bun](https://bun.sh), Docker and [Zellij](https://zellij.dev).

```bash
bun install
for f in apps/*/.env.example; do cp "$f" "${f%.example}"; done   # then fill in provider keys
bun run zellij                                                   # starts Postgres + RabbitMQ, then all services
```

`bun run zellij` brings up the infrastructure via Docker Compose and launches every service in its own pane. To run pieces individually, `bun run dev` uses Turborepo directly.

```bash
bun run test          # integration + unit tests
bun run type-check    # TypeScript across all packages
bun run lint
```

## Status

Built as a diploma thesis project at Šolski center Kranj. It is a working system rather than a production service — the provider integrations are real, but it has not been operated at scale or security-audited.
