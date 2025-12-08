-- ============================================
-- ShowShowShow Database Schema
-- ============================================
-- This file contains the complete database schema
-- Use migrations (001_initial_schema.ts) to apply changes
-- This file is for reference/documentation
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

-- Enable UUID extension (for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content (Shows + Movies)
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tmdb_id INTEGER UNIQUE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('show', 'movie')),
  title TEXT NOT NULL,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  release_date DATE, -- For movies
  first_air_date DATE, -- For shows
  last_air_date DATE, -- For shows
  default_duration INTEGER, -- minutes
  number_of_seasons INTEGER, -- For shows
  number_of_episodes INTEGER, -- For shows
  status TEXT, -- 'ended', 'ongoing', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Episodes (only for shows, not movies)
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  overview TEXT,
  duration INTEGER, -- minutes
  air_date DATE,
  still_url TEXT, -- Episode screenshot
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(content_id, season, episode_number)
);

-- ============================================
-- USER DATA TABLES
-- ============================================

-- Watch History (works for both shows and movies)
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER, -- NULL for movies
  episode INTEGER, -- NULL for movies
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rewatch_count INTEGER DEFAULT 0,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id, season, episode)
);

-- Schedule
CREATE TABLE IF NOT EXISTS schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER, -- NULL for movies
  episode INTEGER, -- NULL for movies
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'auto', 'block', 'rotation')),
  source_id UUID, -- ID of block/rotation if applicable
  watched BOOLEAN DEFAULT false,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER, -- NULL if entire show/movie
  episode INTEGER, -- NULL if entire season/show/movie
  position INTEGER NOT NULL,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROGRAMMING BLOCKS
-- ============================================

-- Programming Blocks (e.g., "Halloween Disney 2004", "Toonami Late 90s")
CREATE TABLE IF NOT EXISTS programming_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  block_type TEXT NOT NULL CHECK (block_type IN ('template', 'custom')),
  criteria JSONB, -- e.g., { "network": "Disney", "year": 2004, "theme": "halloween" }
  schedule_days TEXT[], -- ['Saturday'] or ['Monday', 'Wednesday', 'Friday']
  start_time TIME, -- '18:00'
  end_time TIME, -- '00:00'
  rotation_type TEXT DEFAULT 'sequential' CHECK (rotation_type IN ('sequential', 'random')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shows/Movies in a Programming Block
CREATE TABLE IF NOT EXISTS block_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID REFERENCES programming_blocks(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- Order in block
  time_slot TIME, -- Optional: specific time slot (e.g., '18:00')
  duration INTEGER, -- Optional: override default duration
  current_season INTEGER DEFAULT 1, -- Track progress through block
  current_episode INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(block_id, content_id, position)
);

-- ============================================
-- ROTATION GROUPS (Multi-Show Rotation)
-- ============================================

-- Rotation Groups (for rotating through multiple shows)
CREATE TABLE IF NOT EXISTS rotation_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  rotation_type TEXT DEFAULT 'round_robin' CHECK (rotation_type IN ('round_robin', 'random')),
  max_consecutive INTEGER DEFAULT 1, -- Don't watch same show twice in a row
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content in Rotation
CREATE TABLE IF NOT EXISTS rotation_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rotation_id UUID REFERENCES rotation_groups(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  current_season INTEGER DEFAULT 1,
  current_episode INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rotation_id, content_id)
);

-- ============================================
-- USER PREFERENCES
-- ============================================

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  -- Rerun settings
  include_reruns BOOLEAN DEFAULT false,
  rerun_frequency TEXT DEFAULT 'rarely' CHECK (rerun_frequency IN ('never', 'rarely', 'sometimes', 'often')),
  -- Schedule settings
  max_shows_per_time_slot INTEGER DEFAULT 1,
  time_slot_duration INTEGER DEFAULT 30, -- minutes
  allow_overlap BOOLEAN DEFAULT false,
  -- Default schedule times
  default_start_time TIME DEFAULT '18:00',
  default_end_time TIME DEFAULT '00:00',
  -- Other preferences
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SYNC METADATA
-- ============================================

-- Sync Metadata (track last sync time per user)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  last_sync_time TIMESTAMP WITH TIME ZONE,
  sync_token TEXT, -- Optional: for conflict resolution
  device_id TEXT, -- Optional: track multiple devices
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MIGRATION TRACKING
-- ============================================

-- Kysely Migration Tracking
CREATE TABLE IF NOT EXISTS kysely_migration (
  name VARCHAR(255) PRIMARY KEY,
  timestamp BIGINT NOT NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_tmdb_id ON content(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_episodes_content_season ON episodes(content_id, season);

-- User data indexes
CREATE INDEX IF NOT EXISTS idx_watch_history_user_content ON watch_history(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched_at ON watch_history(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_user_time ON schedule(user_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_schedule_user_watched ON schedule(user_id, watched);
CREATE INDEX IF NOT EXISTS idx_queue_user_position ON queue(user_id, position);

-- Block indexes
CREATE INDEX IF NOT EXISTS idx_block_content_block ON block_content(block_id);
CREATE INDEX IF NOT EXISTS idx_block_content_content ON block_content(content_id);

-- Rotation indexes
CREATE INDEX IF NOT EXISTS idx_rotation_content_rotation ON rotation_content(rotation_id);

-- ============================================
-- HELPER FUNCTIONS (Optional)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at
  BEFORE UPDATE ON programming_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES
-- ============================================
-- 
-- Table Relationships:
-- - users (1) -> (many) watch_history, schedule, queue, programming_blocks, rotation_groups, user_preferences, sync_metadata
-- - content (1) -> (many) episodes, watch_history, schedule, queue, block_content, rotation_content
-- - programming_blocks (1) -> (many) block_content
-- - rotation_groups (1) -> (many) rotation_content
-- 
-- Key Constraints:
-- - content.content_type: 'show' or 'movie'
-- - schedule.source_type: 'manual', 'auto', 'block', or 'rotation'
-- - programming_blocks.block_type: 'template' or 'custom'
-- - programming_blocks.rotation_type: 'sequential' or 'random'
-- - rotation_groups.rotation_type: 'round_robin' or 'random'
-- - user_preferences.rerun_frequency: 'never', 'rarely', 'sometimes', or 'often'
-- 
-- NULL Values:
-- - episodes.season/episode: NULL for movies in watch_history/schedule/queue
-- - queue.season/episode: NULL if entire show/movie is queued
-- - schedule.source_id: NULL if source_type is 'manual' or 'auto'
-- 
-- ============================================

