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

  // ===== LIBRARY TABLE INDEXES =====
  // These indexes are critical for library feature performance

  // user_library: Composite index for user + status (very common filter)
  // Used when filtering library by status (watching, completed, etc.)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_user_status 
    ON user_library(user_id, status)
  `.execute(db);

  // user_library: Composite index for user + content_id (checking if in library)
  // Used when checking if content is already in user's library
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_user_content 
    ON user_library(user_id, content_id)
  `.execute(db);

  // user_library: Index on content_id (for joins with content table)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_content_id 
    ON user_library(content_id)
  `.execute(db);

  // user_library: Index on updated_at DESC (for ordering by recently updated)
  // Used in library list when ordering by "recently updated"
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_updated_at 
    ON user_library(updated_at DESC)
  `.execute(db);

  // user_library: Composite index for user + updated_at DESC (for user's recently updated items)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_user_updated_at 
    ON user_library(user_id, updated_at DESC)
  `.execute(db);

  // user_library: Index on last_watched_at DESC (for ordering by recently watched)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_last_watched_at 
    ON user_library(last_watched_at DESC) WHERE last_watched_at IS NOT NULL
  `.execute(db);

  // user_library: Composite index for user + last_watched_at DESC
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_library_user_last_watched 
    ON user_library(user_id, last_watched_at DESC) WHERE last_watched_at IS NOT NULL
  `.execute(db);

  // library_episode_status: Composite index for user + content (very common query pattern)
  // Used when fetching all episode statuses for a show
  await sql`
    CREATE INDEX IF NOT EXISTS idx_library_episode_status_user_content 
    ON library_episode_status(user_id, content_id)
  `.execute(db);

  // library_episode_status: Composite index for user + content + status (filtering watched episodes)
  // Used when counting watched episodes or filtering by status
  await sql`
    CREATE INDEX IF NOT EXISTS idx_library_episode_status_user_content_status 
    ON library_episode_status(user_id, content_id, status)
  `.execute(db);

  // library_episode_status: Index for ordering by season and episode
  // Used when fetching episodes ordered by season/episode number
  await sql`
    CREATE INDEX IF NOT EXISTS idx_library_episode_status_season_episode 
    ON library_episode_status(content_id, season, episode)
  `.execute(db);

  // ===== ADDITIONAL OPTIMIZATIONS =====

  // Episodes: Index for content_id + season (used in schedule JOINs)
  // Note: Already has composite index, but this helps with season-only queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_episodes_content_season 
    ON episodes(content_id, season)
  `.execute(db);

  // Content: Index on title for text search (helps with ILIKE queries, though not perfect)
  // Note: Full-text search would be better, but this helps with some patterns
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_title 
    ON content(title)
  `.execute(db);

  // Schedule: Index on scheduled_time for date range queries
  // Note: Removed partial index with NOW() as it's not immutable
  // The existing idx_schedule_scheduled_time and idx_schedule_user_time should cover this
  // This index helps with time-only range queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_schedule_time_range 
    ON schedule(scheduled_time)
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop indexes in reverse order
  // Library indexes
  await sql`DROP INDEX IF EXISTS idx_schedule_time_range`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_content_title`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_episodes_content_season`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_library_episode_status_season_episode`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_library_episode_status_user_content_status`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_library_episode_status_user_content`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_user_last_watched`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_last_watched_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_user_updated_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_updated_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_content_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_user_content`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_library_user_status`.execute(db);
  
  // Original indexes
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

