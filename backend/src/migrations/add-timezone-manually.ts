import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Manually add the timezone_offset column to the schedule table
 * This bypasses the migration system to avoid the timestamp recording issue
 */
async function addTimezoneColumn() {
  console.log('🔄 Adding timezone_offset column to schedule table...');

  try {
    // Check if column already exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schedule' 
      AND column_name = 'timezone_offset'
    `.execute(db);

    if (columnExists.rows.length > 0) {
      console.log('✅ timezone_offset column already exists');
    } else {
      // Add timezone_offset column
      await sql`
        ALTER TABLE schedule 
        ADD COLUMN timezone_offset VARCHAR(6) DEFAULT '+00:00'
      `.execute(db);
      console.log('✅ Added timezone_offset column');
    }

    // Check if index exists
    const indexExists = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'schedule' 
      AND indexname = 'idx_schedule_timezone'
    `.execute(db);

    if (indexExists.rows.length > 0) {
      console.log('✅ idx_schedule_timezone index already exists');
    } else {
      // Create index
      await sql`
        CREATE INDEX idx_schedule_timezone ON schedule(timezone_offset)
      `.execute(db);
      console.log('✅ Created idx_schedule_timezone index');
    }

    // Mark migration as complete
    await sql`
      CREATE TABLE IF NOT EXISTS kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp BIGINT NOT NULL
      )
    `.execute(db);

    const migrationExists = await sql`
      SELECT name FROM kysely_migration WHERE name = '002_add_timezone_to_schedule'
    `.execute(db);

    if (migrationExists.rows.length === 0) {
      const now = Date.now();
      await sql`
        INSERT INTO kysely_migration (name, timestamp) 
        VALUES ('002_add_timezone_to_schedule', ${now})
      `.execute(db);
      console.log('✅ Marked migration as complete');
    } else {
      console.log('ℹ️  Migration already marked as complete');
    }

    console.log('\n✅ All done! The timezone_offset column has been added.');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

addTimezoneColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

