import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Helper script to set up migration tracking for existing databases
 * Run this once if your database already has tables but no migration tracking
 */
async function setupMigrationTracking() {
  console.log('🔄 Setting up migration tracking...');

  try {
    // Check if migration table exists and what type timestamp column is
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kysely_migration'
      )
    `.execute(db);

    const tableExistsResult = (tableExists.rows[0] as any)?.exists;

    if (!tableExistsResult) {
      // Create migration tracking table with bigint timestamp (Kysely's format)
      await sql`
        CREATE TABLE kysely_migration (
          name VARCHAR(255) PRIMARY KEY,
          timestamp BIGINT NOT NULL
        )
      `.execute(db);
      console.log('✅ Created migration tracking table');
    } else {
      // Check if timestamp column is the wrong type and fix it
      const columnInfo = await sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'kysely_migration' 
        AND column_name = 'timestamp'
      `.execute(db);

      const dataType = (columnInfo.rows[0] as any)?.data_type;
      
      if (dataType && dataType !== 'bigint') {
        console.log(`⚠️  Fixing timestamp column type from ${dataType} to bigint...`);
        // Migrate existing data if any
        await sql`
          ALTER TABLE kysely_migration 
          ALTER COLUMN timestamp TYPE BIGINT 
          USING CASE 
            WHEN timestamp IS NULL THEN EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
            WHEN ${dataType} = 'timestamp with time zone' THEN EXTRACT(EPOCH FROM timestamp::timestamptz)::BIGINT * 1000
            ELSE timestamp::BIGINT
          END
        `.execute(db);
        console.log('✅ Fixed timestamp column type');
      } else {
        console.log('✅ Migration tracking table verified');
      }
    }

    // Check if users table exists (indicates initial migration was run)
    const usersTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `.execute(db);

    const exists = (usersTableExists.rows[0] as any)?.exists;

    if (exists) {
      // Check if migration already exists
      const migrationExists = await sql`
        SELECT name FROM kysely_migration WHERE name = '001_initial_schema'
      `.execute(db);

      if (migrationExists.rows.length === 0) {
        // Mark initial migration as complete
        // Kysely uses bigint (Unix timestamp in milliseconds) for timestamps
        const now = Date.now();
        await sql`
          INSERT INTO kysely_migration (name, timestamp) 
          VALUES ('001_initial_schema', ${now})
        `.execute(db);
        console.log('✅ Marked 001_initial_schema migration as complete');
      } else {
        // Check if timestamp is null and fix it
        const existing = await sql`
          SELECT timestamp FROM kysely_migration WHERE name = '001_initial_schema'
        `.execute(db);
        const row = existing.rows[0] as any;
        
        if (!row || row.timestamp === null) {
          const now = Date.now();
          await sql`
            UPDATE kysely_migration 
            SET timestamp = ${now}
            WHERE name = '001_initial_schema'
          `.execute(db);
          console.log('✅ Updated 001_initial_schema migration timestamp');
        } else {
          console.log('ℹ️  001_initial_schema migration already tracked');
        }
      }
    } else {
      console.log('ℹ️  Users table not found - initial migration may not have run');
    }

    // List current migrations
    const migrations = await sql`
      SELECT name, timestamp 
      FROM kysely_migration 
      ORDER BY timestamp
    `.execute(db);

    console.log('\n📋 Current migrations:');
    if (migrations.rows.length === 0) {
      console.log('  (none)');
    } else {
      migrations.rows.forEach((row: any) => {
        console.log(`  ✅ ${row.name} - ${row.timestamp}`);
      });
    }

    console.log('\n✅ Migration tracking setup complete!');
    console.log('You can now run: npm run migrate:up');
  } catch (error) {
    console.error('❌ Error setting up migration tracking:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

setupMigrationTracking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

