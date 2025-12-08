import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable UUID extension (for uuid_generate_v4())
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Content table (shows + movies)
  await sql`
    CREATE TABLE IF NOT EXISTS content (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tmdb_id INTEGER UNIQUE NOT NULL,
      content_type TEXT NOT NULL CHECK (content_type IN ('show', 'movie')),
      title TEXT NOT NULL,
      poster_url TEXT,
      backdrop_url TEXT,
      overview TEXT,
      release_date DATE,
      first_air_date DATE,
      last_air_date DATE,
      default_duration INTEGER,
      number_of_seasons INTEGER,
      number_of_episodes INTEGER,
      status TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Episodes table (only for shows)
  await sql`
    CREATE TABLE IF NOT EXISTS episodes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      season INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      overview TEXT,
      duration INTEGER,
      air_date DATE,
      still_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(content_id, season, episode_number)
    )
  `.execute(db);

  // Watch history
  await sql`
    CREATE TABLE IF NOT EXISTS watch_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      season INTEGER,
      episode INTEGER,
      watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      rewatch_count INTEGER DEFAULT 0,
      synced BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, content_id, season, episode)
    )
  `.execute(db);

  // Schedule
  await sql`
    CREATE TABLE IF NOT EXISTS schedule (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      season INTEGER,
      episode INTEGER,
      scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
      duration INTEGER NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'auto', 'block', 'rotation')),
      source_id UUID,
      watched BOOLEAN DEFAULT false,
      synced BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Queue
  await sql`
    CREATE TABLE IF NOT EXISTS queue (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      season INTEGER,
      episode INTEGER,
      position INTEGER NOT NULL,
      synced BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Programming blocks
  await sql`
    CREATE TABLE IF NOT EXISTS programming_blocks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      block_type TEXT NOT NULL CHECK (block_type IN ('template', 'custom')),
      criteria JSONB,
      schedule_days TEXT[],
      start_time TIME,
      end_time TIME,
      rotation_type TEXT DEFAULT 'sequential' CHECK (rotation_type IN ('sequential', 'random')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Block content
  await sql`
    CREATE TABLE IF NOT EXISTS block_content (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      block_id UUID REFERENCES programming_blocks(id) ON DELETE CASCADE,
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      time_slot TIME,
      duration INTEGER,
      current_season INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(block_id, content_id, position)
    )
  `.execute(db);

  // Rotation groups
  await sql`
    CREATE TABLE IF NOT EXISTS rotation_groups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT,
      rotation_type TEXT DEFAULT 'round_robin' CHECK (rotation_type IN ('round_robin', 'random')),
      max_consecutive INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Rotation content
  await sql`
    CREATE TABLE IF NOT EXISTS rotation_content (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      rotation_id UUID REFERENCES rotation_groups(id) ON DELETE CASCADE,
      content_id UUID REFERENCES content(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      current_season INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(rotation_id, content_id)
    )
  `.execute(db);

  // User preferences
  await sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      include_reruns BOOLEAN DEFAULT false,
      rerun_frequency TEXT DEFAULT 'rarely' CHECK (rerun_frequency IN ('never', 'rarely', 'sometimes', 'often')),
      max_shows_per_time_slot INTEGER DEFAULT 1,
      time_slot_duration INTEGER DEFAULT 30,
      allow_overlap BOOLEAN DEFAULT false,
      default_start_time TIME DEFAULT '18:00',
      default_end_time TIME DEFAULT '00:00',
      onboarding_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Sync metadata
  await sql`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      last_sync_time TIMESTAMP WITH TIME ZONE,
      sync_token TEXT,
      device_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `.execute(db);

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_content_tmdb_id ON content(tmdb_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_episodes_content_season ON episodes(content_id, season)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_watch_history_user_content ON watch_history(user_id, content_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched_at ON watch_history(user_id, watched_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_schedule_user_time ON schedule(user_id, scheduled_time)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_schedule_user_watched ON schedule(user_id, watched)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_user_position ON queue(user_id, position)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_block_content_block ON block_content(block_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_block_content_content ON block_content(content_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_rotation_content_rotation ON rotation_content(rotation_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await sql`DROP INDEX IF EXISTS idx_rotation_content_rotation`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_block_content_content`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_block_content_block`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_queue_user_position`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_schedule_user_watched`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_schedule_user_time`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_watch_history_user_watched_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_watch_history_user_content`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_episodes_content_season`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_content_tmdb_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_content_type`.execute(db);

  // Drop tables (in reverse order due to foreign keys)
  await sql`DROP TABLE IF EXISTS sync_metadata CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS user_preferences CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS rotation_content CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS rotation_groups CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS block_content CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS programming_blocks CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS queue CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS schedule CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS watch_history CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS episodes CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS content CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS users CASCADE`.execute(db);
}

