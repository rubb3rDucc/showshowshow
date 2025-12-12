import { Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function up(db: Kysely<Database>): Promise<void> {
  // Check if timezone_offset column already exists
  const columnExists = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'schedule' 
    AND column_name = 'timezone_offset'
  `.execute(db);

  if (columnExists.rows.length === 0) {
    // Add timezone_offset column to schedule table
    // Stores timezone offset in format like "-05:00" (EST) or "+00:00" (UTC)
    await db.schema
      .alterTable('schedule')
      .addColumn('timezone_offset', 'varchar(6)', (col) => col.defaultTo('+00:00'))
      .execute();
    console.log('✅ Added timezone_offset column to schedule table');
  } else {
    console.log('ℹ️  timezone_offset column already exists, skipping');
  }

  // Check if index already exists
  const indexExists = await sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'schedule' 
    AND indexname = 'idx_schedule_timezone'
  `.execute(db);

  if (indexExists.rows.length === 0) {
    // Create index for timezone queries if needed
    await db.schema
      .createIndex('idx_schedule_timezone')
      .on('schedule')
      .column('timezone_offset')
      .execute();
    console.log('✅ Created index on timezone_offset');
  } else {
    console.log('ℹ️  idx_schedule_timezone index already exists, skipping');
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('schedule')
    .dropColumn('timezone_offset')
    .execute();

  await db.schema.dropIndex('idx_schedule_timezone').ifExists().execute();
}

