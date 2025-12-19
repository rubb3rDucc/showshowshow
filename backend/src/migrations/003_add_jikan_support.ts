import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function up(db: Kysely<Database>): Promise<void> {
  // Make tmdb_id nullable to support Jikan content (which doesn't have TMDB IDs)
  await sql`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' 
        AND column_name = 'tmdb_id' 
        AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE content ALTER COLUMN tmdb_id DROP NOT NULL;
      END IF;
    END $$;
  `.execute(db);

  // Add new columns (idempotent - will fail gracefully if already exists)
  await sql`
    DO $$ 
    BEGIN
      -- Add mal_id column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'mal_id'
      ) THEN
        ALTER TABLE content ADD COLUMN mal_id INTEGER;
      END IF;

      -- Add anilist_id column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'anilist_id'
      ) THEN
        ALTER TABLE content ADD COLUMN anilist_id INTEGER;
      END IF;

      -- Add data_source column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'data_source'
      ) THEN
        ALTER TABLE content 
        ADD COLUMN data_source VARCHAR(20) DEFAULT 'tmdb' 
        CHECK (data_source IN ('tmdb', 'jikan', 'anilist', 'kitsu'));
      END IF;

      -- Add title_english column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'title_english'
      ) THEN
        ALTER TABLE content ADD COLUMN title_english VARCHAR(500);
      END IF;

      -- Add title_japanese column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'title_japanese'
      ) THEN
        ALTER TABLE content ADD COLUMN title_japanese VARCHAR(500);
      END IF;
    END $$;
  `.execute(db);

  // Create indexes (idempotent - IF NOT EXISTS)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_mal_id 
    ON content(mal_id) WHERE mal_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_data_source 
    ON content(data_source)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_content_tmdb_mal 
    ON content(tmdb_id, mal_id)
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex('idx_content_tmdb_mal').ifExists().execute();
  await db.schema.dropIndex('idx_content_data_source').ifExists().execute();
  await sql`DROP INDEX IF EXISTS idx_content_mal_id`.execute(db);

  // Drop columns
  await db.schema
    .alterTable('content')
    .dropColumn('title_japanese')
    .dropColumn('title_english')
    .dropColumn('data_source')
    .dropColumn('anilist_id')
    .dropColumn('mal_id')
    .execute();
}

