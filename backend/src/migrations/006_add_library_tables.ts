import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function up(db: Kysely<Database>): Promise<void> {
  // Create user_library table
  await sql`
    CREATE TABLE IF NOT EXISTS user_library (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'plan_to_watch' 
        CHECK (status IN ('watching', 'completed', 'dropped', 'plan_to_watch')),
      current_season INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 1,
      score INTEGER CHECK (score >= 1 AND score <= 10),
      notes TEXT CHECK (char_length(notes) <= 1000),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      last_watched_at TIMESTAMPTZ,
      episodes_watched INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, content_id)
    )
  `.execute(db);

  // Create indexes for user_library
  await sql`CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_user_library_status ON user_library(user_id, status)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_user_library_content_id ON user_library(content_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_user_library_updated_at ON user_library(updated_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_user_library_last_watched_at ON user_library(user_id, last_watched_at DESC)`.execute(db);

  // Create library_episode_status table
  await sql`
    CREATE TABLE IF NOT EXISTS library_episode_status (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
      season INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unwatched'
        CHECK (status IN ('watched', 'unwatched', 'skipped')),
      watched_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, content_id, season, episode)
    )
  `.execute(db);

  // Create indexes for library_episode_status
  await sql`CREATE INDEX IF NOT EXISTS idx_library_episode_status_user_content ON library_episode_status(user_id, content_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_library_episode_status_user ON library_episode_status(user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_library_episode_status_watched ON library_episode_status(user_id, content_id, status) WHERE status = 'watched'`.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP TABLE IF EXISTS library_episode_status CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS user_library CASCADE`.execute(db);
}

