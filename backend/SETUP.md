# Backend Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Database

#### Option A: Supabase (Recommended - Easiest)

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Fill in:
   - Project name: `showshowshow`
   - Database password: (save this!)
   - Region: Choose closest to you
4. Wait ~2 minutes for setup
5. Go to **Project Settings → Database**
6. Find "Connection string" section
7. Copy the **URI** connection string
8. Update `.env`:
   ```bash
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` and `[PROJECT-REF]` with your actual values

#### Option B: Local PostgreSQL

1. Install PostgreSQL:
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Or download from postgresql.org
   ```

2. Create database:
   ```bash
   createdb showshowshow
   ```

3. Update `.env`:
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/showshowshow
   ```
   (Adjust username/password as needed)

### 3. Run Migrations

This will create all the database tables:

```bash
pnpm run migrate:up
```

You should see:
```
📦 Found 1 migration(s)
✅ 0 already applied
🔄 Running migration: 001_initial_schema.ts
✅ Completed: 001_initial_schema.ts
✅ All migrations completed
```

### 4. Start Server

```bash
pnpm run dev
```

You should see:
```
✅ Database connected successfully
🚀 Server running on http://localhost:3000
📊 Health check: http://localhost:3000/health
🧪 Test endpoint: http://localhost:3000/api/test
```

### 5. Test It

Open your browser or use curl:

```bash
# Health check
curl http://localhost:3000/health

# Test endpoint
curl http://localhost:3000/api/test
```

## Troubleshooting

### Database Connection Failed

- Check your `DATABASE_URL` in `.env`
- Make sure database is running (if local)
- For Supabase: Check firewall settings
- Verify credentials are correct

### Migration Errors

- Make sure database exists
- Check connection string is correct
- If tables already exist, you might need to drop them first (be careful!)

### Port Already in Use

- Change `PORT` in `.env` to a different number
- Or kill the process using port 3000

## Next Steps

Once the server is running, you can:
1. Start building API routes in `src/routes/`
2. Add authentication
3. Connect to TMDB API
4. Build schedule generation logic

