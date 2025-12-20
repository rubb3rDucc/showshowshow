import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

/**
 * Migration: Add performance indexes for common query patterns
 * 
 * This migration adds indexes to improve query performance for:
 * - Watch history lookups (user + content + season + episode)
 * - Schedule filtering (watched status, content_type)
 * - Queue operations (content_id lookups)
 * - Content filtering (content_type, data_source combinations)
 * - User email lookups (already has UNIQUE, but explicit index helps)
 */
export async function up(db: Kysely<Database>): Promise<void> {
  // Watch history: Composite index for common lookup pattern
  // Used when checking if user has watched specific episode
  await sql`
    CREATE INDEX IF NOT EXISTS idx_watch_history_user_content_episode 
    ON watch_history(user_id, content_id, season, episode)
  `.execute(db);

  // Watch history: Index for user + content (without episode, for show-level queries)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_watch_history_user_content 
    ON watch_history(user_id, content_id)
  `.execute(db);

  // Schedule: Index on watched status (filtered frequently)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_schedule_watched 
    ON schedule(watched) WHERE watched = false
  `.execute(db);

  // Schedule: Composite index for user + watched status
  await sql`
    CREATE INDEX IF NOT EXISTS idx_schedule_user_watched 
    ON schedule(user_id, watched)
  `.execute(db);

  // Schedule: Index on content_id (used in joins and deletes)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_schedule_content_id 
    ON schedule(content_id)
  `.execute(db);

  // Queue: Index on content_id (used in joins and deletes)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_queue_content_id 
    ON queue(content_id)
  `.execute(db);

  // Content: Index on content_type (filtered in queries)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_content_type 
    ON content(content_type)
  `.execute(db);

  // Content: Composite index for data_source + content_type (common filter combination)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_source_type 
    ON content(data_source, content_type)
  `.execute(db);

  // Content: Index on created_at (used for ordering in library queries)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_created_at 
    ON content(created_at DESC)
  `.execute(db);

  // Users: Explicit index on email (UNIQUE already creates index, but explicit helps query planner)
  // Note: UNIQUE constraint already creates an index, but we'll verify it exists
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'users_email_key'
      ) THEN
        -- This shouldn't happen as UNIQUE creates index, but just in case
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop indexes in reverse order
  await sql`DROP INDEX IF EXISTS idx_content_created_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_content_source_type`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_content_content_type`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_queue_content_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_schedule_content_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_schedule_user_watched`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_schedule_watched`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_watch_history_user_content`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_watch_history_user_content_episode`.execute(db);
}

