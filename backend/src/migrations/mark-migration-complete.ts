import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Manually mark a migration as complete in the kysely_migration table
 * Use this if a migration was run manually or if the migration tracking failed
 */
async function markMigrationComplete() {
  const migrationName = process.argv[2] || '002_add_timezone_to_schedule';
  
  console.log(`🔄 Marking migration "${migrationName}" as complete...`);

  try {
    // Ensure table exists with correct schema
    await sql`
      CREATE TABLE IF NOT EXISTS kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp BIGINT NOT NULL
      )
    `.execute(db);

    // Check if column exists (verify migration actually ran)
    if (migrationName === '002_add_timezone_to_schedule') {
      const columnExists = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'schedule' 
        AND column_name = 'timezone_offset'
      `.execute(db);

      if (columnExists.rows.length === 0) {
        console.error('❌ timezone_offset column does not exist! Run the migration first.');
        process.exit(1);
      }
      console.log('✅ Verified timezone_offset column exists');
    }

    // Check if migration already marked
    const existing = await sql`
      SELECT name FROM kysely_migration WHERE name = ${migrationName}
    `.execute(db);

    if (existing.rows.length > 0) {
      console.log(`ℹ️  Migration "${migrationName}" is already marked as complete`);
    } else {
      const now = Date.now();
      await sql`
        INSERT INTO kysely_migration (name, timestamp) 
        VALUES (${migrationName}, ${now})
      `.execute(db);
      console.log(`✅ Marked "${migrationName}" as complete`);
    }

    // List all migrations
    const migrations = await sql`
      SELECT name, timestamp 
      FROM kysely_migration 
      ORDER BY timestamp
    `.execute(db);

    console.log('\n📋 Current migrations:');
    migrations.rows.forEach((row: any) => {
      const date = new Date(Number(row.timestamp));
      console.log(`  ✅ ${row.name} - ${date.toISOString()}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

markMigrationComplete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

