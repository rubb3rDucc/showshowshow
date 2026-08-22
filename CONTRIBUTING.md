# Contributing to ShowShowShow

Thanks for your interest in contributing. Here's what you need to know to get started.

## Prerequisites

- Node.js 22.x (both packages pin `engines.node`)
- pnpm
- PostgreSQL 15+ (or a Supabase account)
- A Clerk account (authentication)
- A Stripe account (billing, optional for most work)

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md) for the full environment variable reference and setup steps.

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

## Git hooks

Run this once per clone:

```bash
sh scripts/install-hooks.sh
```

It sets `core.hooksPath` to the tracked [`.githooks/`](.githooks/) directory. Hooks in `.git/hooks` are per-clone and never committed, so without this they silently do not exist on a new machine.

`pre-push` runs the same checks CI requires, so a push cannot turn the PR red for something reproducible locally:

1. **Lockfile consistency.** Each project's `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are copied to a temp directory and installed with `--frozen-lockfile`. It has to be a temp directory: with a warm `node_modules`, `pnpm install --frozen-lockfile` short-circuits on "Already up to date" and never compares specifiers, so it passes locally and fails in CI. `--lockfile-only` and `--resolution-only` miss it too, and one of them rewrites the lockfile as a side effect.
2. **Backend tests** (`pnpm run test:run`, matching CI, not just `test:unit`).
3. **Frontend lint.**

`git push --no-verify` skips it, which is reasonable for a WIP branch nobody depends on.

### A note on dependency pins

Security floors for transitive packages live in each project's `pnpm-workspace.yaml` under `overrides`, **not** in `package.json`. pnpm 11 stopped reading the `pnpm` field in `package.json` and ignores it apart from a warning.

This matters when reading a lockfile error: the specifier pnpm compares is the one *after* overrides are applied. An `ERR_PNPM_OUTDATED_LOCKFILE` naming a package you never touched usually means a `package.json` range and an override are disagreeing.

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
