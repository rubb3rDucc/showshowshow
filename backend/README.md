# Backend

Backend API.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Fastify
- **Database:** PostgreSQL (via Supabase or local)
- **ORM:** Kysely
- **Language:** TypeScript

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

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

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
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run migrate:up` - Run database migrations
- `pnpm run migrate:down` - Rollback last migration

## API Endpoints

### Health Check
- `GET /health` - Check server and database status

### Test
- `GET /api/test` - Test endpoint

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts       # Database connection
│   │   └── types.ts       # Kysely types
│   ├── migrations/        # Database migrations
│   ├── routes/           # API routes (to be added)
│   └── index.ts          # Server entry point
├── .env                  # Environment variables (gitignored)
├── .env.example          # Example environment variables
├── package.json
└── tsconfig.json
```

## Development

The server uses `tsx` for TypeScript execution with hot reload. Changes to files in `src/` will automatically restart the server.

## Database

The database schema is defined in migrations. Run migrations to set up the database:

```bash
pnpm run migrate:up
```

To rollback:

```bash
pnpm run migrate:down
```

