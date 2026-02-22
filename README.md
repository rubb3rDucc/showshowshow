# ShowShowShow

A personal TV and anime scheduling app. Build a queue of shows, generate a viewing schedule, and track what you've watched.

Built for people who want to watch TV intentionally — not just scroll and tap something.

## What It Does

- **Queue builder** — Add TV shows, anime, and movies to a queue in any order
- **Schedule generator** — Auto-fill a time block (e.g. 8PM–midnight) with episodes from your queue using round-robin or random rotation
- **Library tracking** — Mark shows as watching, completed, or dropped; track individual episode progress
- **Watch history** — Log what you've actually watched; the scheduler uses this to skip reruns
- **Networks/providers** — Browse and filter content by network or streaming service
- **Anime support** — Searches TMDB for Western content and Jikan/AniList for anime

## Screenshots

### Home — tonight's schedule at a glance
<!-- screenshot: home/tonight view -->
![home pic](/readme_pics/main_feb2026_screenshot.png)

<!--### Lineup builder — drag shows into your queue, generate a schedule -->
<!-- screenshot: lineup/queue builder with calendar timeline -->

### Library — track status and episode progress per show
<!-- screenshot: library grid with status badges -->

![lib pic](/readme_pics/lib_feb2026_screenshot.png)

<!--### Search — find and add content from TMDB or Jikan ->>
<!-- screenshot: search results with content cards -->

## Architecture

```text
  ┌────────────────────────────────────────────────────┐
  │  frontend/   React 19 + Vite                       │
  │                                                    │
  │  Pages  :  Home  Lineup  Library  Search  Stats    │
  │  Auth   :  Clerk SDK                               │
  │  State  :  TanStack Query + Zustand                │
  │  UI     :  Mantine + Tailwind CSS                  │
  └───────────────────────┬────────────────────────────┘
                          │
                          │  REST  /api/*
                          │  Authorization: Bearer <token>
                          │
                          ▼
  ┌────────────────────────────────────────────────────┐
  │  backend/   Fastify + Kysely + PostgreSQL          │
  │                                                    │
  │  Routes  :  queue   schedule   library   content   │
  │             billing   networks   user   webhooks   │
  │  Auth    :  Clerk JWT verification                 │
  │  Billing :  Stripe subscription entitlements       │
  └────┬──────────────┬──────────────┬──────────┬──────┘
       │              │              │          │
       ▼              ▼              ▼          ▼
  PostgreSQL        TMDB           Jikan     Stripe
  (Kysely ORM)   (Western TV     (Anime)   (Billing)
                  & movies)

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

  smallweb/   Astro   standalone marketing site
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+ (local or [Supabase](https://supabase.com))
- [Clerk](https://clerk.com) account (authentication)
- [TMDB API key](https://www.themoviedb.org/settings/api) (content search)

### 1. Clone and install

```bash
git clone <repo-url>
cd showshowshow
```

### 2. Set up the backend

```bash
cd backend
pnpm install
cp .env.example .env
# Edit .env with your values (see backend/README.md for details)
pnpm run migrate:up
pnpm run dev
```

Backend runs on `http://localhost:3000`.

### 3. Set up the frontend

```bash
cd frontend
pnpm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000
# Set VITE_CLERK_PUBLISHABLE_KEY from your Clerk dashboard
pnpm run dev
```

Frontend runs on `http://localhost:5173`.

### Required environment variables

**Backend** (`backend/.env`):

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | From Clerk dashboard |
| `CLERK_WEBHOOK_SECRET` | Configure webhook in Clerk → `POST /api/webhooks/clerk` |
| `TMDB_API_KEY` | From themoviedb.org |

**Frontend** (`frontend/.env`):

| Variable | Description |
| -------- | ----------- |
| `VITE_API_URL` | Backend URL (default: `http://localhost:3000`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key (`pk_...`) — same value as `CLERK_PUBLISHABLE_KEY` in the backend |

Optional: Stripe keys for billing, PostHog for analytics. See [`backend/README.md`](backend/README.md) for the full list.

## Project Structure

```text
showshowshow/
├── backend/          # Fastify REST API
├── frontend/         # React SPA
└── smallweb/         # Astro landing page
```

See each subdirectory's README for component-specific details:
- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`smallweb/README.md`](smallweb/README.md)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Elastic License 2.0 — see [`LICENSE`](LICENSE). Source available; commercial hosting of this software as a service is not permitted.
