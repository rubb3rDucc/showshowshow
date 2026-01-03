# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShowShowShow is a personalized TV/anime scheduling application with three main components:
- **Backend**: Fastify REST API with PostgreSQL (Node.js + TypeScript)
- **Frontend**: React 19 SPA with Vite (TypeScript + Tailwind CSS)
- **Smallweb**: Marketing landing page (Astro)

The app allows users to queue TV shows/movies, auto-generate viewing schedules, track watch history, and manage their media library. It integrates with TMDB for Western content and supports Jikan/AniList for anime.

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Supabase account)
- pnpm package manager

### Environment Variables
Backend requires (`.env` in `/backend`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key (32+ chars for production)
- `TMDB_API_KEY` - From themoviedb.org

Frontend requires (`.env` in `/frontend`):
- `VITE_API_URL` - Backend URL (default: `http://localhost:3000`)

### Initial Setup
```bash
# Backend
cd backend
pnpm install
pnpm run migrate:up
pnpm run dev  # Starts on port 3000

# Frontend (in separate terminal)
cd frontend
pnpm install
pnpm run dev  # Starts on port 5173

# Smallweb (optional, for landing page)
cd smallweb
pnpm install
pnpm run dev  # Starts on port 4321
```

## Common Development Commands

### Backend
```bash
# Development
pnpm run dev                # Hot reload server

# Database
pnpm run migrate:up         # Run all pending migrations
pnpm run migrate:down       # Rollback last migration
pnpm run migrate:inspect    # Check migration table state
pnpm run migrate:sync       # Auto-detect existing schema and mark migrations complete
pnpm run migrate:clean      # Clean invalid entries

# Testing
pnpm run test              # Run all Vitest tests
pnpm run test:unit         # Unit tests only
pnpm run test:integration  # Integration tests
cd tests && ./run-local-tests.sh  # Shell-based integration tests

# Build
pnpm run build            # TypeScript → JavaScript
pnpm run start            # Run production build
```

### Frontend
```bash
pnpm run dev              # Start Vite dev server
pnpm run build            # Build for production
pnpm run lint             # Run ESLint
pnpm run preview          # Preview production build
```

### Docker
```bash
docker-compose up         # Start both frontend + backend in dev mode
docker-compose down       # Stop containers
```

## Architecture

### Backend Architecture

**Framework**: Fastify with plugin-based architecture

**Key Plugins** (`/backend/src/plugins/`):
- `auth.ts` - JWT authentication middleware (authenticateUser decorator)
- `error-handler.ts` - Global error handling and formatting
- `security.ts` - Helmet security headers
- `rate-limit.ts` - Rate limiting (general + auth-specific)
- `admin-auth.ts` - Admin role verification

**Database** (`/backend/src/db/`):
- **ORM**: Kysely (type-safe SQL query builder)
- `index.ts` - Database connection and Kysely instance
- `types.ts` - TypeScript database schema types (12 tables)

**Core Tables**:
- `users` - User accounts with admin flag
- `content` - Cached TV shows/movies (TMDB/Jikan/AniList)
- `episodes` - Episode metadata per show
- `queue` - User's viewing queue (ordered list)
- `schedule` - Generated schedule items with timezone support
- `watch_history` - Viewing history tracking
- `library_items` - User's library with ratings/status
- `networks` - TV networks/streaming services
- `programming_blocks` - Network programming blocks (Adult Swim, Toonami)

**API Routes** (`/backend/src/routes/`):
All routes prefixed with `/api`:
- `auth.ts` - `/auth/*` - Register, login, JWT management
- `content.ts` - `/content/*` - Search, cache content, fetch episodes
- `library.ts` - `/library/*` - Library CRUD, ratings, stats
- `queue.ts` - `/queue/*` - Queue management, reordering
- `schedule.ts` - `/schedule/*` - View schedules by date/range
- `schedule-generate.ts` - `/schedule/generate/*` - Auto-generate schedules
- `user.ts` - `/user/*` - User profile management
- `networks.ts` - `/networks/*` - Network/provider management
- `people.ts` - `/people/*` - Person/cast details
- `waitlist.ts` - `/waitlist/*` - Waitlist signups (for landing page)

**External APIs** (`/backend/src/lib/`):
- `tmdb.ts` - TMDB API integration (search, content, episodes)
- `jikan.ts` - Jikan/MyAnimeList API for anime
- Both handle rate limiting, caching, and error recovery

**Schedule Generation** (`/backend/src/lib/schedule-generator.ts`):
- Round-robin mode: cycles through queue shows in order
- Random mode: random selection from queue
- Randomizes episodes within each show
- Handles midnight crossover and same-day scheduling
- Supports timezone offsets (e.g., EST, UTC)
- Mixed content support (TV shows + movies)

**Migrations** (`/backend/src/migrations/`):
- Custom migration runner (not a third-party tool)
- Migrations are numbered files: `001_initial_schema.ts`, `002_add_timezone_to_schedule.ts`, etc.
- Each exports `up()` and `down()` functions
- `runner.ts` - Migration execution engine
- `migrate-utils.ts` - Utilities for inspecting/syncing migrations

**Migration Troubleshooting**:
If migrations fail with "table already exists":
1. Run `pnpm run migrate:sync` to detect existing schema
2. Then run `pnpm run migrate:up` normally
3. Use `pnpm run migrate:inspect` to check state

### Frontend Architecture

**Framework**: React 19 with functional components and hooks

**Routing**: Wouter (lightweight React router)
- Routes defined in `App.tsx`
- `ProtectedRoute` wrapper for authenticated pages

**State Management**:
- **Zustand** for global state (`/frontend/src/stores/`)
  - `authStore.ts` - Auth state, token persistence (localStorage)
- **TanStack Query** for server state caching
  - Configured in `App.tsx` with 30s stale time
  - Used throughout API layer for automatic caching/refetching

**API Client** (`/frontend/src/api/`):
- `client.ts` - Base fetch client with auth header injection
- Domain-specific modules: `auth.ts`, `content.ts`, `library.ts`, `schedule.ts`, `networks.ts`, `people.ts`, `user.ts`
- All use TanStack Query hooks for data fetching

**Component Organization** (`/frontend/src/components/`):
- `auth/` - Login/register forms, ProtectedRoute
- `layout/` - Layout, navigation, header
- `browse/` - Content browsing components
- `library/` - Library cards, detail modals, episode tracking
- `queue/` - Queue list, drag-drop reordering
- `schedule/` - Schedule calendar, cards, generators
- `search/` - Search interface, content cards
- `settings/` - User settings, profile
- `stats/` - Activity tracking, statistics
- `common/` - Shared utilities

**Pages** (`/frontend/src/pages/`):
- `Home.tsx` - Dashboard/landing
- `Browse.tsx` - Browse content by network/genre
- `Search.tsx` - Content search
- `Queue.tsx` - Queue management
- `Library.tsx` - User's library
- `Networks.tsx` - Network/provider browsing
- `Settings.tsx` - User settings
- `Stats.tsx` - User statistics
- Login/Register - Authentication

**Styling**:
- Tailwind CSS for utility-first styling
- Mantine UI components (forms, dates, core)
- Custom CSS in component directories where needed

**Key Frontend Patterns**:
- All authenticated requests use `authStore.getToken()` for JWT
- TanStack Query mutations invalidate related queries on success
- Form validation handled by Mantine forms
- Drag-and-drop queue reordering with @dnd-kit

### Smallweb (Landing Page)

**Framework**: Astro (static site generator)
- Single-page marketing site
- Brutalist design aesthetic
- Waitlist integration with backend API
- Image rotation system (4s intervals)
- Analytics: Umami (optional)

## Key Technical Details

### Authentication Flow
1. User registers/logs in via `/api/auth/*`
2. Backend returns JWT token
3. Frontend stores token in localStorage (`authStore`)
4. All authenticated requests include `Authorization: Bearer <token>` header
5. Backend `authenticateUser` plugin validates JWT and injects `request.user`

### Content Caching Strategy
- Search results from TMDB are displayed but not cached
- User explicitly caches content via `/api/content/:tmdbId?type={tv|movie}`
- Cached content stored in `content` table with episodes in `episodes` table
- Cache checking: `GET /api/content/:tmdbId/check` returns `is_cached`, `cached_id`, `cached_type`
- **Important**: TMDB IDs can exist as both TV and movie (e.g., ID 30991), so `?type=` param is required

### Schedule Generation Algorithm
1. User adds content to queue
2. Calls `/api/schedule/generate/queue` with:
   - `start_time` (e.g., "22:00")
   - `end_time` (e.g., "02:00")
   - `start_date`, `end_date`
   - `mode` ("round-robin" or "random")
   - `timezone_offset` (e.g., "-05:00" for EST)
3. Generator (`schedule-generator.ts`):
   - Fetches queue items and their episodes
   - Shuffles episodes within each show
   - Allocates time slots based on mode
   - Handles midnight crossover (e.g., 22:00 → 02:00 next day)
   - Creates schedule entries with timezone offset
4. Schedule items stored with `scheduled_time` (UTC) + `timezone_offset`

### Testing Strategy

**Backend**:
- Vitest for unit/integration tests (`/backend/tests/unit/`)
- Shell scripts for integration testing (`/backend/tests/*.sh`)
- Test files: `auth.test.ts`, `rate-limit.test.ts`, `errors.test.ts`
- Run single test: `pnpm run test <file-pattern>`

**Frontend**:
- No test framework currently configured
- ESLint for code quality

## Important Patterns

### Error Handling
- Backend uses custom error classes (`/backend/src/lib/errors.ts`)
- `BadRequestError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`
- Global error handler plugin formats all errors consistently
- Frontend displays errors via Sonner toast notifications

### Type Safety
- Backend: Full TypeScript with Kysely-generated DB types
- Frontend: TypeScript with explicit types for API responses
- Database schema types in `/backend/src/db/types.ts` are the source of truth

### API Parameter Conventions
- Query params: `?start_date=2024-01-01&type=tv`
- URL params: `/api/content/:tmdbId`
- Request body: JSON (validated with Zod where applicable)

### Migration Workflow
When schema changes are needed:
1. Create new migration file: `backend/src/migrations/00X_description.ts`
2. Export `up()` and `down()` functions using Kysely schema builder
3. Run `pnpm run migrate:up`
4. Update `types.ts` if schema changes affect types
5. Commit migration files (they're version controlled)

## Common Pitfalls

1. **TMDB Type Ambiguity**: Always use `?type=tv` or `?type=movie` when fetching content by TMDB ID
2. **Migration Sync Issues**: If tables exist but migrations aren't marked complete, run `pnpm run migrate:sync`
3. **JWT Expiry**: Default is 7 days (`JWT_EXPIRES_IN`), frontend doesn't auto-refresh tokens
4. **CORS**: Backend CORS configured for `FRONTEND_URL` env var (default: http://localhost:5173)
5. **Rate Limiting**: Auth endpoints have stricter limits (100/hour) vs general endpoints (1000/hour)
6. **Timezone Handling**: Schedule times stored in UTC with separate `timezone_offset` field

## Code Style Preferences

- **Backend**: ESM modules (`.js` imports), async/await, Kysely query builder
- **Frontend**: Functional components, hooks, Zustand for global state, TanStack Query for server state
- **Imports**: Absolute imports from `src/` in both frontend/backend
- **Error handling**: Always use custom error classes in backend, never throw raw strings
- **Database queries**: Use Kysely transaction helpers for multi-step operations
- **API responses**: Consistent JSON structure: `{ data: {...} }` or `{ error: "message" }`
