import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function up(db: Kysely<Database>): Promise<void> {
  // Increase rating column size from VARCHAR(20) to VARCHAR(100) to accommodate longer ratings
  await sql`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' 
        AND column_name = 'rating'
        AND character_maximum_length = 20
      ) THEN
        ALTER TABLE content ALTER COLUMN rating TYPE VARCHAR(100);
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Revert to VARCHAR(20) - note: this may fail if any ratings exceed 20 characters
  await sql`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' 
        AND column_name = 'rating'
        AND character_maximum_length = 100
      ) THEN
        ALTER TABLE content ALTER COLUMN rating TYPE VARCHAR(20);
      END IF;
    END $$;
  `.execute(db);
}

