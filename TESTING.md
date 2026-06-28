# Testing & CI

How tests are organized and run for ShowShowShow. This doc grows as each test layer
lands; today it covers the frontend unit tests and the existing backend suite.

## Test layers

| Layer | Tool | Status |
| --- | --- | --- |
| Frontend unit (pure logic, no DOM) | Vitest | ✅ available |
| Backend unit + integration | Vitest | ✅ available |
| Frontend E2E crash-smoke (multi-engine) | Playwright | planned |

## Running tests locally

Prerequisites: Node 22, pnpm 11.9.0.

### Frontend unit tests

```bash
cd frontend
pnpm test           # run once (CI uses this)
pnpm test:watch     # watch mode while developing
pnpm test:coverage  # with a coverage report
```

These are **pure-logic** tests only — no DOM, no rendering. They live next to the code
as `*.test.ts` (e.g. `src/utils/rating.test.ts`, `src/components/queue/calendar/utils.test.ts`).

### Backend tests

```bash
cd backend
pnpm test:run          # all tests once
pnpm test:coverage     # with coverage
pnpm test:integration  # integration suite — needs local Postgres + backend/.env
```

## Writing frontend tests — conventions

The frontend UI is in active redesign, so tests must **not** break on visual changes.
Follow these rules:

- **Test pure logic, not the UI.** Good targets: utilities, data transforms, the
  calendar/schedule time math, ranking/categorization (`upNext`/`needsYou`). Avoid
  testing rendered markup, copy, or styling.
- **No snapshot tests, no pixel diffs, no assertions on DOM structure or text content.**
- **Keep assertions timezone-independent.** Pass a fixed `now` into functions that take
  it; use local-time strings (`2026-01-01T06:00:00`, no trailing `Z`) when a function
  reads `getHours()`/`getMinutes()`; prefer date-only formatting over time-of-day.
- **Co-locate** the test as `<name>.test.ts` beside the source file.

Tests are type-checked by `tsc -b` (part of `pnpm build`), so import test globals
explicitly (`import { describe, it, expect } from 'vitest'`) and keep them type-clean.

## CI

`pnpm test` runs in the `test-frontend` job of `.github/workflows/ci.yaml` on every push
and PR, alongside lint, build, and the dependency audit.
