import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function up(db: Kysely<Database>): Promise<void> {
  // Add rating column to content table (nullable, for Jikan ratings like TV-14, TV-MA, R, etc.)
  await sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content' AND column_name = 'rating'
      ) THEN
        ALTER TABLE content ADD COLUMN rating VARCHAR(20);
      END IF;
    END $$;
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('content')
    .dropColumn('rating')
    .execute();
}



