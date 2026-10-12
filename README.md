# ShowShowShow

TV, movie, and anime tracker and review web app.

Built for me.

### Reasons why I built it.

- I don't like Letterbox because it works like a social media app; i don't like social media apps.
- Letterbox only tracks movies but I like the interface. MyAnimelist only tracks anime but the interface is trash.
- There isn't a good desktop/web and mobile app that does TV, Movie and Anime tracking. They either suck to use, charge stupid amounts of money for minimal features, iOS or Android only, and have unnecessary social media integrations (I don't care that Susan likes Breaking Bad).
- There aren't any algorithm-less apps available that had a quiet design. I don't want pings or notifications on what I haven't watched or an algorithm that thinks it knows what I want to watch next either.

## What It Does

- **Lineup builder.** Add TV shows, anime, and movies to a lineup in any order, with per-show scheduling flags.
- **Schedule generator.** Auto-fill a time block (say 8PM to midnight) with episodes from your lineup, using round-robin or random rotation. It fills empty gaps only and never double-books.
- **Library tracking.** Mark shows watching, plan to watch, completed, or dropped. Track episode-level progress, per season or all at once.
- **Lists.** Build ranked or unranked collections, reorder by drag, and export one as a shareable image or plain text.
- **Reviews.** Write long-form reviews in a rich text editor.
- **Stats.** Weekly and all-time activity, completion counts, and genre breakdowns.
- **Networks and providers.** Browse and filter content by network or streaming service.
- **Anime support.** TMDB for Western content, Jikan (MyAnimeList) for anime, unified behind a single content record so a title is the same entity whichever source it came from.

## Screenshots

### Home, quick add and the shows that need you

![home pic](/readme_pics/main_oct2026.png)

### Library, a poster grid of everything you track

![lib pic](/readme_pics/lib_oct2026.png)

### Lists, ranked and unranked collections

![lists pic](/readme_pics/lib_lists_oct2026.png)

### Search, movies, TV and anime in one place

![search pic](/readme_pics/search_oct2026.png)

### Stats, totals and shows in progress

![stats pic](/readme_pics/data_oct2026.png)

### Reviews, a monthly journal of what you watched

![reviews pic](/readme_pics/reviews_oct2026.png)

### Movie page, status and score at a glance

![movie detail pic](/readme_pics/content_detail_oct2026.png)

### Movie page, cast, crew and similar titles

![movie detail cast pic](/readme_pics/contdetail_cont_oct2026.png)

### Anime page, related entries and where to watch

![anime detail pic](/readme_pics/contentanime_oct2026.png)

### Quick view, change status without leaving the library

![quick view pic](/readme_pics/moviecard_oct2026.png)

### Quick view, full-size poster

![poster pic](/readme_pics/poster_detail_oct2026.png)

### Quick view, completed and rated

![completed rated pic](/readme_pics/goodmovie_rated_oct2026.png)

### Quick view, plan to watch and unrated

![unrated pic](/readme_pics/unrated_notwatched_oct2026.png)

### Quick view, watching with a score

![watching rated pic](/readme_pics/watched_rated_moviecard_oct2026.png)

## Architecture

```text
  ┌────────────────────────────────────────────────────┐
  │  frontend/   React 19 + Vite + Wouter              │
  │                                                    │
  │  Pages :  Home    Lineup   Library   Search        │
  │           Browse  Reviews  Stats     Settings      │
  │  Auth  :  Clerk SDK                                │
  │  State :  TanStack Query                           │
  │  UI    :  Mantine + Tailwind CSS                   │
  └───────────────────────┬────────────────────────────┘
                          │
                          │  REST  /api/*
                          │  Authorization: Bearer <token>
                          │
                          ▼
  ┌────────────────────────────────────────────────────┐
  │  backend/   Fastify + Kysely + PostgreSQL          │
  │                                                    │
  │  Routes  :  queue     schedule  library   content  │
  │             lists     reviews   people    networks │
  │             billing   user      auth      webhooks │
  │  Auth    :  Clerk JWT verification                 │
  │  Billing :  Stripe subscription entitlements       │
  │  Cache   :  Redis (TMDB and Jikan responses)       │
  └────┬──────────────┬──────────────┬──────────┬──────┘
       │              │              │          │
       ▼              ▼              ▼          ▼
  PostgreSQL        TMDB           Jikan     Stripe
   (Kysely)      (Western TV      (Anime)   (Billing)
                  & movies)

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

  smallweb/   Astro        standalone marketing site
  docsite/    Docusaurus   documentation site
```

## Quick Start

### Prerequisites

- Node.js 22.x (both packages pin `engines.node`)
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+ (local or [Supabase](https://supabase.com))
- [Clerk](https://clerk.com) account (authentication)
- [TMDB API key](https://www.themoviedb.org/settings/api) (content search)

Redis is optional in development. Without it, TMDB and Jikan responses simply are not cached.

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

Frontend runs on `http://localhost:5173`, or `$FRONTEND_PORT` if set.

### Required environment variables

**Backend** (`backend/.env`):

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | From Clerk dashboard |
| `CLERK_WEBHOOK_SECRET` | Configure webhook in Clerk, pointing at `POST /api/webhooks/clerk` |
| `TMDB_API_KEY` | From themoviedb.org |

**Frontend** (`frontend/.env`):

| Variable | Description |
| -------- | ----------- |
| `VITE_API_URL` | Backend URL (default `http://localhost:3000`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_...`), the same value as `CLERK_PUBLISHABLE_KEY` in the backend |

Optional: Stripe keys for billing, PostHog for analytics, `REDIS_URL` for caching. See [`backend/README.md`](backend/README.md) for the full list.

## Project Structure

```text
showshowshow/
├── backend/          # Fastify REST API
├── frontend/         # React SPA
├── smallweb/         # Astro marketing site (showshowshow.app)
├── docsite/          # Docusaurus documentation site
└── readme_pics/      # Screenshots used by this file
```

See each subdirectory's README for component-specific details:

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`smallweb/README.md`](smallweb/README.md)
- [`docsite/README.md`](docsite/README.md)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Elastic License 2.0, see [`LICENSE`](LICENSE). Source available; commercial hosting of this software as a service is not permitted.
