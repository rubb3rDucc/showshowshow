-- ShowShowShow Database Schema
-- Complete SQL schema for manual database setup or reference

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content table (shows and movies from TMDB)
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tmdb_id INTEGER NOT NULL,
  content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('show', 'movie')),
  title VARCHAR(500) NOT NULL,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  release_date DATE,
  first_air_date DATE,
  last_air_date DATE,
  default_duration INTEGER NOT NULL DEFAULT 30,
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  status VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tmdb_id, content_type)
);

CREATE INDEX idx_content_tmdb_id ON content(tmdb_id, content_type);

-- Episodes table
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title VARCHAR(500),
  overview TEXT,
  duration INTEGER NOT NULL DEFAULT 30,
  air_date DATE,
  still_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(content_id, season, episode_number)
);

CREATE INDEX idx_episodes_content_id ON episodes(content_id);
CREATE INDEX idx_episodes_content_season_episode ON episodes(content_id, season, episode_number);

-- Watch history table
CREATE TABLE watch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER,
  episode INTEGER,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rewatch_count INTEGER NOT NULL DEFAULT 0,
  synced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX idx_watch_history_content_id ON watch_history(content_id);

-- Schedule table
CREATE TABLE schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER,
  episode INTEGER,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL,
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'auto', 'block', 'rotation')),
  source_id UUID,
  watched BOOLEAN NOT NULL DEFAULT FALSE,
  synced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_user_id ON schedule(user_id);
CREATE INDEX idx_schedule_scheduled_time ON schedule(scheduled_time);
CREATE INDEX idx_schedule_user_time ON schedule(user_id, scheduled_time);

-- Queue table
CREATE TABLE queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season INTEGER,
  episode INTEGER,
  position INTEGER NOT NULL,
  synced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queue_user_id ON queue(user_id);
CREATE INDEX idx_queue_user_position ON queue(user_id, position);

-- Programming blocks table
CREATE TABLE programming_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  block_type VARCHAR(20) NOT NULL DEFAULT 'custom' CHECK (block_type IN ('template', 'custom')),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_days TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  start_time TIME,
  end_time TIME,
  rotation_type VARCHAR(20) NOT NULL DEFAULT 'sequential' CHECK (rotation_type IN ('sequential', 'random')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programming_blocks_user_id ON programming_blocks(user_id);

-- Block content table (shows/movies in a programming block)
CREATE TABLE block_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES programming_blocks(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  time_slot TIME,
  duration INTEGER,
  current_season INTEGER NOT NULL DEFAULT 1,
  current_episode INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_block_content_block_id ON block_content(block_id);

-- Rotation groups table
CREATE TABLE rotation_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  rotation_type VARCHAR(20) NOT NULL DEFAULT 'round_robin' CHECK (rotation_type IN ('round_robin', 'random')),
  max_consecutive INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rotation_groups_user_id ON rotation_groups(user_id);

-- Rotation content table (shows/movies in a rotation group)
CREATE TABLE rotation_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rotation_id UUID NOT NULL REFERENCES rotation_groups(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  current_season INTEGER NOT NULL DEFAULT 1,
  current_episode INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rotation_content_rotation_id ON rotation_content(rotation_id);

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  include_reruns BOOLEAN NOT NULL DEFAULT FALSE,
  rerun_frequency VARCHAR(20) NOT NULL DEFAULT 'rarely' CHECK (rerun_frequency IN ('never', 'rarely', 'sometimes', 'often')),
  max_shows_per_time_slot INTEGER NOT NULL DEFAULT 1,
  time_slot_duration INTEGER NOT NULL DEFAULT 30,
  allow_overlap BOOLEAN NOT NULL DEFAULT FALSE,
  default_start_time TIME,
  default_end_time TIME,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync metadata table
CREATE TABLE sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  last_sync_time TIMESTAMPTZ,
  sync_token TEXT,
  device_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programming_blocks_updated_at
  BEFORE UPDATE ON programming_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


