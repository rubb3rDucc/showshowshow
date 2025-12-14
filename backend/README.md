# ShowShowShow Backend

REST API for personalized TV/anime scheduling with TMDB integration.

## Features

- 🔐 JWT authentication with bcrypt
- 🎬 TMDB content search and caching
- 📋 Queue management (add/remove/reorder)
- 📅 Auto-schedule generation (round-robin/random)
- ✅ Cache checking to prevent duplicates
- 🎯 Type-specific content fetching (TV vs movies)
- ⚡ Episode randomization and mixed content support

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Fastify
- **Database:** PostgreSQL 15+
- **Query Builder:** Kysely
- **Language:** TypeScript
- **External API:** TMDB

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Setup

#### Option A: Supabase (Recommended)

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings → Database
4. Copy the connection string
5. Update `.env` with your connection string:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL locally
2. Create database:
```bash
createdb showshowshow
```
3. Update `.env`:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/showshowshow
```

### 3. Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/showshowshow

# Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# TMDB API (get key from https://www.themoviedb.org/settings/api)
TMDB_API_KEY=your-tmdb-api-key

# PostHog Error Tracking (optional - get key from https://posthog.com)
POSTHOG_API_KEY=your-posthog-api-key
POSTHOG_HOST=https://us.i.posthog.com  # Optional, defaults to US instance

# Frontend URL (for CORS and CSP - set in production)
FRONTEND_URL=https://your-frontend-domain.com  # Optional, defaults to localhost:5173 in dev

# Server
PORT=3000
NODE_ENV=development
```

### 4. Run Database Migrations

```bash
pnpm run migrate:up
```

### 5. Start Development Server

```bash
pnpm run dev
```

Server will start on `http://localhost:3000`

## Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build TypeScript to JavaScript
- `pnpm run start` - Start production server
- `pnpm run migration:up` - Run database migrations
- `pnpm run migration:down` - Rollback migrations

## Quick Test

```bash
# Terminal 1: Start server
pnpm run dev

# Terminal 2: Run tests
cd tests
./test-content-types.sh
```

## API Endpoints

**Authentication**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user

**Content**
- `GET /api/content/search?q={query}&type={tv|movie}` - Search TMDB
- `GET /api/content/:tmdbId?type={tv|movie}` - Get/cache content
- `GET /api/content/:tmdbId/check` - Check if cached (prevents duplicates)
- `GET /api/content/:tmdbId/episodes` - Get episodes for TV shows
- `GET /api/content/library` - Get user's library

**Queue**
- `GET /api/queue` - Get user's queue
- `POST /api/queue` - Add content to queue
- `DELETE /api/queue/:id` - Remove from queue
- `PATCH /api/queue/:id/reorder` - Reorder queue
- `DELETE /api/queue` - Clear entire queue

**Schedule**
- `GET /api/schedule/date/:date` - Get schedule for date
- `GET /api/schedule/range?start={date}&end={date}` - Get date range
- `POST /api/schedule/generate/queue` - Auto-generate from queue
- `DELETE /api/schedule/:id` - Delete schedule item

## Project Structure

```
backend/
├── src/
│   ├── db/                      # Database
│   │   ├── index.ts             # Connection & Kysely instance
│   │   └── types.ts             # Generated types
│   ├── lib/                     # Core utilities
│   │   ├── auth.ts              # JWT & bcrypt helpers
│   │   ├── tmdb.ts              # TMDB API integration
│   │   ├── errors.ts            # Custom error classes
│   │   └── schedule-generator.ts # Schedule generation logic
│   ├── plugins/                 # Fastify plugins
│   │   ├── auth.ts              # Auth middleware
│   │   └── error-handler.ts    # Global error handler
│   ├── routes/                  # API routes
│   │   ├── auth.ts              # Authentication endpoints
│   │   ├── content.ts           # Content & search endpoints
│   │   ├── queue.ts             # Queue management
│   │   ├── schedule.ts          # Schedule viewing
│   │   └── schedule-generate.ts # Schedule generation
│   ├── migrations/              # Database migrations
│   │   ├── runner.ts            # Migration runner
│   │   ├── 001_initial_schema.ts
│   │   └── schema.sql           # Raw SQL reference
│   └── index.ts                 # Server entry point
├── tests/                       # Test scripts
│   ├── test-content-types.sh   # Content type tests
│   ├── toonami-tests.sh         # Integration tests
│   └── test-cache-check.sh     # Cache checking tests
├── dist/                        # Compiled JS (gitignored)
├── .env                         # Environment vars (gitignored)
├── package.json
└── tsconfig.json
```

## Development

The server uses hot reload - changes to `src/` automatically restart the server.

### Database Schema

12 tables including: users, content, episodes, queue, schedule, watch_history, sync_metadata, programming_blocks, and more.

```bash
# Apply migrations
pnpm run migration:up

# Rollback
pnpm run migration:down

# View schema
cat src/migrations/schema.sql
```

### Example Usage

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Search
curl "http://localhost:3000/api/content/search?q=Cowboy%20Bebop&type=tv" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Cache show (with type parameter to avoid ambiguity)
curl "http://localhost:3000/api/content/30991?type=tv" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Fetch episodes
curl "http://localhost:3000/api/content/30991/episodes" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Key Features

### Media Scheduling
- **Round-robin**: Cycles through shows in order
- **Random**: Random selection from queue
- Episodes are randomized within each show
- Supports mixed content (TV shows + movies)
- Handles midnight crossover and same-day scheduling

### Cache Checking
Search results include `is_cached`, `cached_id`, and `cached_type` to prevent duplicate caching.

### Type-Specific Caching
Use `?type=tv` or `?type=movie` parameter since some TMDB IDs exist as both (e.g., ID 30991).


## Testing

```bash
# Run all tests
cd tests && ./run-local-tests.sh

# Individual tests
./test-content-types.sh      # Type handling
./toonami-tests.sh            # Integration tests
./test-cache-check.sh         # Cache checking
```

## Deployment

Supports: Digital Ocean, Railway, Render, Fly.io, Vercel, AWS/GCP/Azure.

Set environment variables and run:
```bash
pnpm install
pnpm run migration:up
pnpm run build
pnpm start
```

## Troubleshooting

**Server won't start?**
- Check DATABASE_URL in `.env`
- Verify PostgreSQL is running
- Run migrations: `pnpm run migration:up`

**TMDB errors?**
- Verify TMDB_API_KEY in `.env`
- Get key from: https://www.themoviedb.org/settings/api

**Wrong content cached?**
- Use `?type=tv` or `?type=movie` parameter
- Some TMDB IDs exist as both movies and TV shows