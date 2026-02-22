# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShowShowShow is a personalized TV/anime scheduling application with three main components:
- **Backend**: Fastify REST API with PostgreSQL (Node.js + TypeScript)
- **Frontend**: React 19 SPA with Vite (TypeScript + Tailwind CSS)
- **Smallweb**: Marketing landing page (Astro)

The app allows users to queue TV shows/movies, auto-generate viewing schedules, track watch history, and manage their media library. It integrates with TMDB for Western content and supports Jikan/AniList for anime.

## Communication Preferences

**When explaining concepts, planning features, or discussing architecture:**

- Write in plain English without code snippets interlaced in explanations
- Keep focus on understanding the "what" and "why" rather than jumping to implementation
- When code is actually needed, ask first: "Ready to create [specific file name]?" or "Should I write the [component/route/service] for this?"
- Only create code files when confirmed - write them as separate, complete files (not snippets in chat)
- This keeps the conversation focused on concepts and decisions, with code as deliberate implementation steps

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Supabase account)
- pnpm package manager
- Clerk account (for authentication)
- Stripe account (for billing, optional for development)

### Environment Variables
Backend requires (`.env` in `/backend`):
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk API secret (sk_...)
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key (pk_...)
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (whsec_...)
- `TMDB_API_KEY` - From themoviedb.org
- `STRIPE_SECRET_KEY` - Stripe API secret (optional for dev)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (optional for dev)
- `STRIPE_PRICE_ID` - Stripe price ID for subscriptions (optional for dev)
- `FRONTEND_URL` - Frontend URL for redirects (default: `http://localhost:5173`)
- `JWT_SECRET` - Legacy JWT signing key (still used for non-Clerk flows)

Frontend requires (`.env` in `/frontend`):
- `VITE_API_URL` - Backend URL (default: `http://localhost:3000`)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key (pk_...)

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
- `clerk-auth.ts` - Clerk JWT authentication (authenticateClerk decorator, requireClerkAdmin)
- `auth.ts` - Legacy JWT authentication (still available for backward compatibility)
- `entitlements.ts` - Subscription entitlement checking (requireSubscription decorator)
- `error-handler.ts` - Global error handling and formatting
- `security.ts` - Helmet security headers
- `rate-limit.ts` - Rate limiting (general + auth-specific)
- `rls-context.ts` - Row-level security context for database queries
- `request-timing.ts` - Request performance logging

**Database** (`/backend/src/db/`):
- **ORM**: Kysely (type-safe SQL query builder)
- `index.ts` - Database connection and Kysely instance
- `types.ts` - TypeScript database schema types (20+ tables)

**Core Tables**:
- `users` - User accounts with Clerk integration (clerk_user_id, auth_provider, is_admin, activated_at)
- `content` - Cached TV shows/movies (TMDB/Jikan/AniList/Kitsu with multi-language titles)
- `episodes` - Episode metadata per show
- `queue` - User's viewing queue/lineup (ordered list) - will migrate to `lineups` table
- `schedule` - Generated schedule items with timezone support - will migrate to `scheduled_items`
- `watch_history` - Viewing history tracking
- `library_items` - User's library with ratings/status
- `library_episode_status` - Episode-level tracking within library
- `networks` - TV networks/streaming services with sort order
- `content_networks` - Many-to-many relationship between content and networks
- `programming_blocks` - Reusable content blocks for scheduling
- `block_content` - Content within programming blocks
- `rotation_groups` - Content rotation groups
- `rotation_content` - Content within rotation groups
- `user_preferences` - User settings (reruns, time slot duration, etc.)
- `user_entitlements` - Subscription plan tracking (free/preview/pro)
- `stripe_subscriptions` - Stripe subscription records
- `stripe_webhook_events` - Webhook event log for idempotency
- `waitlist` - Email waitlist with discount codes

**API Routes** (`/backend/src/routes/`):
All routes prefixed with `/api`:
- `auth.ts` - `/auth/*` - Register, login, legacy JWT management (simplified with Clerk)
- `billing.ts` - `/billing/*` - Stripe subscription management:
  - `POST /billing/checkout-session` - Create Stripe checkout
  - `POST /billing/portal-session` - Customer portal for managing subscriptions
  - `POST /billing/webhook` - Handle Stripe webhook events
  - `GET /billing/status` - Get user's subscription status
- `clerk-webhooks.ts` - `/webhooks/clerk` - Clerk webhook events (user lifecycle)
- `content.ts` - `/content/*` - Search, cache content, fetch episodes
- `library.ts` - `/library/*` - Library CRUD, ratings, stats
- `queue.ts` - `/queue/*` - Queue/lineup management, reordering
- `schedule.ts` - `/schedule/*` - View schedules by date/range
- `schedule-generate.ts` - `/schedule/generate/*` - Auto-generate schedules
- `user.ts` - `/user/*` - User profile management
- `networks.ts` - `/networks/*` - Network/provider management
- `people.ts` - `/people/*` - Person/cast details
- `waitlist.ts` - `/waitlist/*` - Waitlist signups (for landing page)

**External APIs & Integrations** (`/backend/src/lib/`):
- `tmdb.ts` - TMDB API integration (search, content, episodes)
- `jikan.ts` - Jikan/MyAnimeList API for anime
- `stripe.ts` - Stripe API integration for billing
- `posthog.ts` - PostHog analytics for backend event tracking
- All handle rate limiting, caching, and error recovery

**Schedule Generation** (`/backend/src/lib/schedule-generator.ts`):
- Round-robin mode: cycles through queue shows in order
- Random mode: random selection from queue
- Randomizes episodes within each show
- Handles midnight crossover and same-day scheduling
- Supports timezone offsets (e.g., EST, UTC)
- Mixed content support (TV shows + movies)

**Migrations** (`/backend/src/migrations/`):
- Custom migration runner (not a third-party tool)
- Migrations are numbered files: `001_initial_schema.ts` through `018_add_stripe_webhook_events.ts`
- Each exports `up()` and `down()` functions
- `runner.ts` - Migration execution engine
- `migrate-utils.ts` - Utilities for inspecting/syncing migrations
- `schema.sql` - Complete canonical schema definition

**Recent Migrations** (012-018):
- `012_add_clerk_integration.ts` - Added clerk_user_id, auth_provider to users
- `013_add_library_episode_status.ts` - Episode-level library tracking
- `014_add_user_preferences.ts` - User preference settings
- `015_add_user_activation.ts` - User activation tracking
- `016_add_user_entitlements.ts` - Subscription entitlement system
- `017_add_stripe_subscriptions.ts` - Stripe subscription storage
- `018_add_stripe_webhook_events.ts` - Webhook idempotency tracking

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
- **Clerk** for authentication (`@clerk/clerk-react`)
  - `useAuth()` - Access auth state and tokens
  - `useUser()` - Access user profile
  - No custom auth store needed (Clerk manages sessions)
- **TanStack Query** for server state caching
  - Configured in `App.tsx` with 30s stale time
  - Used throughout API layer for automatic caching/refetching
- **React useState/Context** for local UI state (upgrade modal, etc.)

**API Client** (`/frontend/src/api/`):
- `client.ts` - Base fetch client with Clerk token injection
- Domain-specific modules: `auth.ts`, `content.ts`, `library.ts`, `schedule.ts`, `networks.ts`, `people.ts`, `user.ts`, `billing.ts`
- All use TanStack Query hooks for data fetching
- 403 errors trigger subscription upgrade modal automatically

**Component Organization** (`/frontend/src/components/`):
- `auth/` - ProtectedRoute wrapper
- `billing/` - UpgradeModal for subscription upsells
- `layout/` - Layout, navigation, header
- `browse/` - Content browsing components
- `home/` - Home page components (TonightSection, etc.)
- `library/` - Library cards, detail modals, episode tracking
- `queue/` - Queue/lineup builder with calendar timeline and drag-drop
- `schedule/` - Schedule calendar, cards, generators
- `search/` - Search interface, content cards
- `settings/` - User settings, profile
- `stats/` - Activity tracking, statistics
- `common/` - Shared utilities

**Pages** (`/frontend/src/pages/`):
- `Home.tsx` - Dashboard with tonight's schedule
- `Browse.tsx` - Browse content by network/genre
- `Search.tsx` - Content search
- `Queue.tsx` - Queue/lineup builder (routed as `/lineup`)
- `Library.tsx` - User's library
- `Networks.tsx` - Network/provider browsing
- `Settings.tsx` - User settings
- `Stats.tsx` - User statistics
- `Login.tsx` - Clerk-powered login
- `Register.tsx` - Clerk-powered registration
- `ClerkTest.tsx` - Testing page for Clerk integration

**Styling**:
- Tailwind CSS for utility-first styling
- Mantine UI components (forms, dates, core)
- Custom CSS in component directories where needed

**Key Frontend Patterns**:
- All authenticated requests use Clerk's `getToken()` for JWT
- TanStack Query mutations invalidate related queries on success
- Form validation handled by Mantine forms
- Drag-and-drop queue reordering with @dnd-kit
- 403 errors automatically trigger upgrade modal via event listeners
- PostHog analytics integrated with user identification

### Smallweb (Landing Page)

**Framework**: Astro (static site generator)
- Single-page marketing site
- Brutalist design aesthetic
- Waitlist integration with backend API
- Image rotation system (4s intervals)
- Analytics: Umami (optional)

## Key Technical Details

### Subscription & Billing Flow
1. New users automatically get `preview` entitlement (7-day trial)
2. When subscription required, 403 error triggers upgrade modal
3. User clicks "Upgrade" → `/api/billing/checkout-session` creates Stripe session
4. User completes payment in Stripe Checkout
5. Stripe webhook → `/api/billing/webhook` processes event
6. User entitlement updated to `pro` in `user_entitlements` table
7. Subscription record created in `stripe_subscriptions` table
8. User can manage subscription via `/api/billing/portal-session`

**Entitlement Tiers**:
- `free` - No active subscription (expired trial or canceled)
- `preview` - 7-day free trial (default for new users)
- `pro` - Active paid subscription

**Backend Protection**:
- Use `requireSubscription(['pro', 'preview'])` decorator on routes
- Returns 403 if user doesn't have required entitlement
- Frontend automatically shows upgrade modal on 403

### Authentication Flow (Clerk-based)
1. User registers/logs in via Clerk UI components
2. Clerk manages session and JWT tokens
3. Frontend uses `useAuth()` hook to get token via `getToken()`
4. All authenticated requests include `Authorization: Bearer <clerk-token>` header
5. Backend `authenticateClerk` plugin validates Clerk JWT and syncs user to database
6. Clerk webhooks (`/api/webhooks/clerk`) handle user lifecycle events (creation, updates, deletion)
7. User record in database linked via `clerk_user_id` field

**Legacy JWT Flow** (still supported):
- Direct `/api/auth/register` and `/api/auth/login` endpoints available
- Uses `auth_provider='jwt'` in database
- `authenticateUser` plugin validates legacy JWT tokens

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
3. **Clerk Configuration**: Ensure webhook endpoint is configured in Clerk dashboard pointing to `/api/webhooks/clerk`
4. **Stripe Webhooks**: Must configure webhook endpoint in Stripe dashboard pointing to `/api/billing/webhook`
5. **Subscription Entitlements**: Check user has required entitlement before allowing feature access
6. **CORS**: Backend CORS configured for `FRONTEND_URL` env var (default: http://localhost:5173)
7. **Rate Limiting**: Auth endpoints have stricter limits (100/hour) vs general endpoints (1000/hour)
8. **Timezone Handling**: Schedule times stored in UTC with separate `timezone_offset` field
9. **Clerk User Sync**: Users are created in database on first login via webhook, not at registration

## Current UI State & Planned Migration

⚠️ **IMPORTANT**: The codebase is in a transitional state between architectures and naming conventions.

### Current State (As-Is)
**Visible in UI:**
- **Lineup/Queue page** (`/frontend/src/pages/Queue.tsx`, routed at `/lineup`)
  - Main scheduling interface with calendar timeline and drag-drop
  - Users build their queue and generate schedules from it
  - Current primary user interface

**Authentication & Billing:**
- Clerk-based authentication fully integrated
- Stripe subscription system active with 7-day preview trials
- All components updated to "quiet utility" design philosophy (Jan 2026)

### Canonical Model (Target State)
**Documented in `docs/DATA_MODEL.md`:**
- `lineups` table - Time-bounded viewing schedules (planned)
- `scheduled_items` table - Items within lineups (planned)
- Separation of "intent" (lineups) vs "reflection" (watch history)

### Current Database Schema (Interim)
**Actually implemented:**
- `queue` table - Will migrate to `lineups` concept
- `schedule` table - Will migrate to `scheduled_items`
- Works but terminology doesn't match target model

### What This Means for Development

1. **When working on "lineup" features**: Modify Queue.tsx and `/api/queue/*` routes
2. **Data model migration is planned**: queue → lineups, schedule → scheduled_items
3. **Authentication**: Use Clerk (`authenticateClerk`), not legacy JWT
4. **Billing**: Use `requireSubscription` decorator for protected features
5. **Environment**: Clerk and Stripe environment variables are REQUIRED

**For detailed migration history and plans**, see `docs/MIGRATION_NOTES.md`.

## Code Style Preferences

- **Backend**: ESM modules (`.js` imports), async/await, Kysely query builder
- **Frontend**: Functional components, hooks, Clerk for auth, TanStack Query for server state
- **Imports**: Absolute imports from `src/` in both frontend/backend
- **Error handling**: Always use custom error classes in backend, never throw raw strings
- **Database queries**: Use Kysely transaction helpers for multi-step operations
- **API responses**: Consistent JSON structure: `{ data: {...} }` or `{ error: "message" }`
- **Authentication**: Use Clerk `authenticateClerk` for new routes, `requireSubscription` for paid features
- **Analytics**: Track important events with PostHog (backend: `posthog.capture()`, frontend: `posthog.capture()`)
- **Webhooks**: Always verify webhook signatures (Clerk uses svix, Stripe uses stripe.webhooks.constructEvent)
- **Idempotency**: Use `stripe_webhook_events` table to prevent duplicate webhook processing
