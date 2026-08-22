# ShowShowShow Backend

Fastify REST API for the ShowShowShow scheduling app.

## Tech Stack

- **Runtime:** Node.js 22.x
- **Framework:** Fastify
- **Database:** PostgreSQL 15+
- **Query Builder:** Kysely (type-safe SQL)
- **Language:** TypeScript
- **Auth:** Clerk (JWT verification)
- **Content APIs:** TMDB (Western TV and film), Jikan / MyAnimeList (anime)
- **Cache:** Redis, optional in development

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Database

#### Option A: Local PostgreSQL

```bash
createdb showshowshow
```

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/showshowshow
```

#### Option B: Supabase

Create a project at [supabase.com](https://supabase.com), then copy the connection string from Project Settings → Database.

### 3. Environment variables

```bash
cp .env.example .env
```

**Required:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | From Clerk dashboard (`pk_...`) |
| `CLERK_SECRET_KEY` | From Clerk dashboard (`sk_...`) |
| `CLERK_WEBHOOK_SECRET` | After configuring webhook in Clerk dashboard (`whsec_...`) |
| `TMDB_API_KEY` | From [themoviedb.org](https://www.themoviedb.org/settings/api) |

**Optional:**

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | For billing features |
| `STRIPE_WEBHOOK_SECRET` | For Stripe webhook handling |
| `STRIPE_PRICE_ID` | Stripe price ID for subscriptions |
| `POSTHOG_API_KEY` | Analytics (PostHog) |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |
| `JWT_SECRET` | Legacy JWT signing key (fallback auth) |

### 4. Clerk webhook setup

In the Clerk dashboard, create a webhook pointing to `POST /api/webhooks/clerk` on your backend URL. Enable the `user.created`, `user.updated`, and `user.deleted` events. Copy the signing secret to `CLERK_WEBHOOK_SECRET`.

### 5. Run migrations

```bash
pnpm run migrate:up
```

### 6. Start development server

```bash
pnpm run dev
```

Server starts on `http://localhost:3000`.

## Scripts

| Script | Description |
|---|---|
| `pnpm run dev` | Start with hot reload |
| `pnpm run build` | Compile TypeScript |
| `pnpm run start` | Run production build |
| `pnpm run test` | Run all tests |
| `pnpm run migrate:up` | Apply pending migrations |
| `pnpm run migrate:down` | Rollback last migration |
| `pnpm run migrate:inspect` | Show migration table state |
| `pnpm run migrate:sync` | Mark existing tables as migrated |
| `pnpm run migrate:clean` | Remove invalid migration entries |

## API Routes

All routes are prefixed with `/api`.

**Authentication**
- `POST /api/auth/register` - Legacy registration (JWT flow)
- `POST /api/auth/login` - Legacy login
- `GET /api/auth/me` - Current user

**Content**
- `GET /api/content/search?q={query}&type={tv|movie}` - Search TMDB
- `GET /api/content/:tmdbId?type={tv|movie}` - Get and cache content
- `GET /api/content/:tmdbId/check` - Check if content is cached
- `GET /api/content/:tmdbId/episodes` - Get episodes for a show

**Queue**
- `GET /api/queue` - Get user's queue
- `POST /api/queue` - Add to queue
- `DELETE /api/queue/:id` - Remove from queue
- `PATCH /api/queue/:id/reorder` - Reorder queue
- `DELETE /api/queue` - Clear entire queue

**Schedule**
- `GET /api/schedule/date/:date` - Schedule for a date
- `GET /api/schedule/range?start={date}&end={date}` - Date range
- `POST /api/schedule/generate/queue` - Auto-generate from queue
- `DELETE /api/schedule/:id` - Delete a schedule item

**Library**
- `GET /api/library` - User's library
- `GET /api/library/stats` - Counts by status and type
- `GET /api/library/stats/weekly` - Weekly activity
- `GET /api/library/stats/detailed` - Genre and completion breakdowns
- `GET /api/library/check/:contentId` - Is this already in the library
- `POST /api/library` - Add to library
- `PATCH /api/library/:id` - Update status, score, or notes
- `DELETE /api/library/:id` - Remove from library
- `GET /api/library/:contentId/episodes` - Episode watch status
- `POST /api/library/:contentId/episodes/mark` - Mark one episode
- `POST /api/library/:contentId/episodes/mark-season` - Mark a season
- `POST /api/library/:contentId/episodes/mark-all` - Mark every episode

**Lists**

Open to any signed-in user, not subscription-gated. Items reference `content.id`,
so TMDB and Jikan titles are handled identically.

- `GET /api/lists` - User's lists
- `GET /api/lists/:id` - One list with its items
- `POST /api/lists` - Create a list
- `PATCH /api/lists/:id` - Rename, re-describe, or toggle ranked
- `DELETE /api/lists/:id` - Delete a list
- `POST /api/lists/:id/items` - Add items by `content_ids`
- `DELETE /api/lists/:id/items/:content_id` - Remove an item
- `PUT /api/lists/:id/items/reorder` - Reorder a ranked list

**Reviews**
- `GET /api/reviews` - User's reviews
- `GET /api/reviews/:id` - One review
- `POST /api/reviews` - Create
- `PATCH /api/reviews/:id` - Update
- `DELETE /api/reviews/:id` - Delete

**People**
- `GET /api/people/:id` - Person detail and credits

**Billing**
- `POST /api/billing/checkout-session` - Create Stripe checkout
- `POST /api/billing/portal-session` - Stripe customer portal
- `POST /api/billing/webhook` - Stripe webhook handler
- `GET /api/billing/status` - User's subscription status

**Other**
- `GET /api/networks` - Networks and providers
- `GET /api/user` - User profile
- `POST /api/waitlist` - Waitlist signup
- `POST /api/webhooks/clerk` - Clerk lifecycle events

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts             # Database connection
│   │   └── types.ts             # Kysely table types
│   ├── lib/
│   │   ├── tmdb.ts              # TMDB API client
│   │   ├── jikan.ts             # Jikan/AniList client
│   │   ├── stripe.ts            # Stripe integration
│   │   ├── schedule-generator.ts
│   │   ├── errors.ts            # Custom error classes
│   │   ├── content-type.ts      # tv/movie/show normalization
│   │   ├── rating-utils.ts
│   │   ├── redis.ts             # Cache client
│   │   └── posthog.ts           # Analytics
│   ├── migrations/
│   │   ├── runner.ts            # Migration engine
│   │   ├── migrate-utils.ts
│   │   ├── 001_initial_schema.ts
│   │   └── ... (021 migrations total)
│   ├── plugins/
│   │   ├── clerk-auth.ts        # Clerk JWT auth
│   │   ├── entitlements.ts      # Subscription checks
│   │   ├── error-handler.ts
│   │   ├── rate-limit.ts
│   │   ├── request-timing.ts
│   │   ├── rls-context.ts       # Sets the RLS user for each request
│   │   └── security.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── billing.ts
│   │   ├── clerk-webhooks.ts
│   │   ├── content.ts
│   │   ├── library.ts
│   │   ├── lists.ts
│   │   ├── networks.ts
│   │   ├── people.ts
│   │   ├── queue.ts
│   │   ├── reviews.ts
│   │   ├── schedule.ts
│   │   ├── schedule-generate.ts
│   │   ├── user.ts
│   │   └── waitlist.ts
│   └── index.ts                 # Server entry point
├── tests/
│   ├── unit/                    # Vitest unit tests
│   ├── integration/             # Vitest integration tests (test-app.ts harness)
│   ├── setup/                   # Shared mocks and helpers
│   ├── load/                    # k6 load script
│   └── *.sh                     # Shell smoke tests (need a running server)
└── tsconfig.json
```

## Migration Troubleshooting

If you see "table already exists" errors after cloning on an existing database:

```bash
pnpm run migrate:sync   # detect existing tables and mark migrations complete
pnpm run migrate:up     # then apply any remaining migrations
```

If migrations are out of sync:

```bash
pnpm run migrate:inspect  # see current state
pnpm run migrate:clean    # remove invalid entries
pnpm run migrate:sync     # re-sync
```

## Authentication

Auth is applied by importing the preHandler functions directly. They are plain
functions, not Fastify decorators, so there is no `fastify.authenticateClerk`.

```typescript
import { authenticateClerk } from '../plugins/clerk-auth.js'

fastify.get('/api/my-route', { preHandler: authenticateClerk }, async (request, reply) => {
  const userId = request.user.userId
  // ...
})
```

For subscription-gated routes, swap in the entitlement check, which authenticates
first and then requires an active `pro` or `preview` plan (admins bypass it):

```typescript
import { requireActiveSubscription } from '../plugins/entitlements.js'

fastify.post('/api/my-route', { preHandler: requireActiveSubscription }, handler)
```

Pick deliberately. `authenticateClerk` means any signed-in user, which is what
lists and all read paths use. `requireActiveSubscription` is the paywall.

## Key Patterns

- **Error handling:** Use custom error classes from `src/lib/errors.ts` - never throw raw strings
- **Database queries:** Use Kysely transactions for multi-step operations
- **API responses:** `{ data: {...} }` for success, `{ error: "message" }` for errors
- **TMDB type ambiguity:** Always include `?type=tv` or `?type=movie` - some TMDB IDs exist as both
- **Webhooks:** Always verify signatures (Clerk uses svix, Stripe uses `stripe.webhooks.constructEvent`)
