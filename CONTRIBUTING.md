# Contributing to ShowShowShow

Thanks for your interest in contributing. Here's what you need to know to get started.

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL 15+ (or a Supabase account)
- A Clerk account (authentication)
- A Stripe account (billing, optional for most work)

See [CLAUDE.md](CLAUDE.md) for the full environment variable reference and setup steps.

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd showshowshow

# Backend
cd backend
pnpm install
cp .env.example .env   # fill in required values
pnpm run migrate:up
pnpm run dev           # http://localhost:3000

# Frontend (separate terminal)
cd frontend
pnpm install
cp .env.example .env   # fill in VITE_API_URL and VITE_CLERK_PUBLISHABLE_KEY
pnpm run dev           # http://localhost:5173
```

## Project Layout

| Directory | Purpose |
| --------- | ------- |
| `backend/` | Fastify REST API (Node.js + TypeScript + Kysely) |
| `frontend/` | React 19 SPA (Vite + Tailwind + Clerk) |
| `smallweb/` | Astro marketing landing page |
| `docs/` | Architecture notes and data model docs |

## Workflow

1. Branch off `master` with a descriptive name (`feat/...`, `fix/...`, `chore/...`).
2. Keep commits focused. One logical change per commit.
3. Open a pull request against `master`. Fill in the description with what changed and why.
4. All CI checks must pass before merging.

## Backend Conventions

- Use `authenticateClerk` for new authenticated routes; avoid the legacy JWT plugin for new work.
- Protect paid features with the `requireSubscription` decorator.
- Use Kysely for all database queries — no raw SQL strings.
- Throw custom error classes from `src/lib/errors.ts`, never plain strings.
- Wrap multi-step database operations in a Kysely transaction.
- Track important events with `posthog.capture()`.

### Database Migrations

```bash
# Create a new migration file
# backend/src/migrations/00X_description.ts
# Export up() and down() functions using the Kysely schema builder

pnpm run migrate:up        # apply
pnpm run migrate:down      # rollback last
pnpm run migrate:inspect   # check state
```

Update `backend/src/db/types.ts` whenever the schema changes.

## Frontend Conventions

- Use `useAuth()` / `useUser()` from Clerk — there is no custom auth store.
- Fetch server data with TanStack Query hooks; use mutations to invalidate related queries.
- A `403` response should dispatch a `show-upgrade-modal` custom event rather than handling it inline.
- Prefer Mantine components for forms and UI primitives.
- Track analytics events with `posthog.capture()` after significant user actions.

## Testing

```bash
# Backend unit + integration tests
cd backend
pnpm run test

# Backend shell-based integration tests
cd backend/tests && ./run-local-tests.sh

# Frontend linting
cd frontend
pnpm run lint
```

There is no frontend test framework yet — lint is the baseline check.

## Code Style

- TypeScript throughout. Avoid `any`.
- ESM imports in the backend (`.js` extension on relative imports).
- Functional React components and hooks only.
- API responses follow `{ data: {...} }` or `{ error: "message" }`.

## Reporting Issues

Open an issue on GitHub with steps to reproduce, expected behaviour, and actual behaviour. Screenshots or request/response logs are helpful for UI or API bugs.
