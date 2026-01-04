import { db } from '../db/index.js';
import { sql } from 'kysely';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Unified migration utility script with subcommands
 * 
 * Usage:
 *   tsx src/migrations/migrate-utils.ts <command> [args...]
 * 
 * Commands:
 *   inspect    - Inspect migration table state
 *   sync       - Sync migrations by detecting existing schema
 *   mark       - Mark a migration as complete (usage: mark <migration-name>)
 *   clean      - Clean invalid entries and fix schema
 *   verify     - Verify specific migrations (usage: verify jikan)
 */
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'inspect':
        await inspect();
        break;
      case 'sync':
        await sync();
        break;
      case 'mark':
        await mark(args[0]);
        break;
      case 'clean':
        await clean();
        break;
      case 'verify':
        await verify(args[0]);
        break;
      default:
        console.error('Usage: tsx src/migrations/migrate-utils.ts <command> [args...]');
        console.error('\nCommands:');
        console.error('  inspect              - Inspect migration table state');
        console.error('  sync                 - Sync migrations by detecting existing schema');
        console.error('  mark <migration>     - Mark a migration as complete');
        console.error('  clean                - Clean invalid entries and fix schema');
        console.error('  verify <type>        - Verify specific migrations (jikan)');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

/**
 * Inspect the migration table state
 */
async function inspect() {
  console.log('🔍 Inspecting kysely_migration table...\n');

  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'kysely_migration'
    )
  `.execute(db);

  const exists = (tableExists.rows[0] as any)?.exists;

  if (!exists) {
    console.log('❌ kysely_migration table does not exist');
    return;
  }

  const columnInfo = await sql`
    SELECT data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'kysely_migration' 
    AND column_name = 'timestamp'
  `.execute(db);

  const colInfo = (columnInfo.rows[0] as any);
  console.log(`📋 Column type: ${colInfo?.data_type || 'unknown'}`);
  console.log(`   Nullable: ${colInfo?.is_nullable || 'unknown'}\n`);

  const rows = await sql`
    SELECT name, timestamp, pg_typeof(timestamp) as timestamp_type
    FROM kysely_migration
    ORDER BY name
  `.execute(db);

  console.log(`📋 Found ${rows.rows.length} migration records:\n`);
  
  for (const row of rows.rows) {
    const name = (row as any).name;
    const timestamp = (row as any).timestamp;
    const type = (row as any).timestamp_type;
    
    console.log(`  ${name}:`);
    console.log(`    Type: ${type}`);
    console.log(`    Value: ${timestamp}`);
    
    try {
      let converted: Date | null = null;
      if (timestamp instanceof Date) {
        converted = timestamp;
      } else if (typeof timestamp === 'string') {
        converted = new Date(timestamp);
      } else if (typeof timestamp === 'number' || typeof timestamp === 'bigint') {
        converted = new Date(Number(timestamp));
      }
      
      if (converted && !isNaN(converted.getTime())) {
        console.log(`    ✅ Valid date: ${converted.toISOString()}`);
      } else {
        console.log(`    ❌ Invalid date`);
      }
    } catch (error) {
      console.log(`    ❌ Conversion error: ${error}`);
    }
    console.log('');
  }
}

/**
 * Sync migrations by detecting existing schema
 */
async function sync() {
  console.log('🔄 Syncing migration state with database...\n');

  // Ensure migration table exists with correct schema
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'kysely_migration'
    )
  `.execute(db);

  const exists = (tableExists.rows[0] as any)?.exists;

  if (!exists) {
    await sql`
      CREATE TABLE kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `.execute(db);
    console.log('✅ Created kysely_migration table\n');
  } else {
    // Check and fix schema if needed
    const columnInfo = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kysely_migration' 
      AND column_name = 'timestamp'
    `.execute(db);

    const dataType = (columnInfo.rows[0] as any)?.data_type;
    if (dataType && dataType !== 'timestamp with time zone' && dataType !== 'timestamptz') {
      console.log('⚠️  Fixing migration table schema...');
      await fixMigrationTableSchema();
      console.log('✅ Migration table schema fixed\n');
    }
  }

  // Get existing migrations
  const existing = await sql`SELECT name FROM kysely_migration`.execute(db);
  const existingNames = new Set(existing.rows.map((r: any) => r.name));

  // Check for 001_initial_schema
  const usersTableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `.execute(db);

  if ((usersTableExists.rows[0] as any)?.exists && !existingNames.has('001_initial_schema')) {
    console.log('✅ Detected 001_initial_schema (users table exists)');
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES ('001_initial_schema', ${new Date()})
      ON CONFLICT (name) DO NOTHING
    `.execute(db);
  }

  // Check for 002_add_timezone_to_schedule
  const timezoneColumnExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'schedule' 
      AND column_name = 'timezone_offset'
    )
  `.execute(db);

  if ((timezoneColumnExists.rows[0] as any)?.exists && !existingNames.has('002_add_timezone_to_schedule')) {
    console.log('✅ Detected 002_add_timezone_to_schedule (timezone_offset column exists)');
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES ('002_add_timezone_to_schedule', ${new Date()})
      ON CONFLICT (name) DO NOTHING
    `.execute(db);
  }

  // Check for 003_add_jikan_support
  const malIdExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'content' 
      AND column_name = 'mal_id'
    )
  `.execute(db);

  if ((malIdExists.rows[0] as any)?.exists && !existingNames.has('003_add_jikan_support')) {
    console.log('✅ Detected 003_add_jikan_support (mal_id column exists)');
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES ('003_add_jikan_support', ${new Date()})
      ON CONFLICT (name) DO NOTHING
    `.execute(db);
  }

  // Check for 004_add_content_rating
  const ratingExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'content' 
      AND column_name = 'rating'
    )
  `.execute(db);

  if ((ratingExists.rows[0] as any)?.exists && !existingNames.has('004_add_content_rating')) {
    console.log('✅ Detected 004_add_content_rating (rating column exists)');
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES ('004_add_content_rating', ${new Date()})
      ON CONFLICT (name) DO NOTHING
    `.execute(db);
  }

  // Show final state
  const final = await sql`
    SELECT name, timestamp 
    FROM kysely_migration 
    ORDER BY timestamp
  `.execute(db);

  console.log('\n📋 Current migration state:');
  final.rows.forEach((row: any) => {
    console.log(`  ✅ ${row.name} - ${row.timestamp}`);
  });

  console.log('\n✅ Sync complete!');
}

/**
 * Mark a migration as complete
 */
async function mark(migrationName?: string) {
  if (!migrationName) {
    console.error('❌ Usage: tsx src/migrations/migrate-utils.ts mark <migration-name>');
    return;
  }

  console.log(`🔄 Marking migration "${migrationName}" as complete...`);

  await sql`
    CREATE TABLE IF NOT EXISTS kysely_migration (
      name VARCHAR(255) PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL
    )
  `.execute(db);

  const existing = await sql`
    SELECT name FROM kysely_migration WHERE name = ${migrationName}
  `.execute(db);

  if (existing.rows.length > 0) {
    console.log(`ℹ️  Migration "${migrationName}" is already marked as complete`);
  } else {
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES (${migrationName}, ${new Date()})
    `.execute(db);
    console.log(`✅ Marked "${migrationName}" as complete`);
  }

  const migrations = await sql`
    SELECT name, timestamp 
    FROM kysely_migration 
    ORDER BY timestamp
  `.execute(db);

  console.log('\n📋 Current migrations:');
  migrations.rows.forEach((row: any) => {
    console.log(`  ✅ ${row.name} - ${row.timestamp}`);
  });
}

/**
 * Clean invalid entries and fix schema
 */
async function clean() {
  console.log('🔄 Cleaning kysely_migration table...\n');

  // Ensure table exists with correct schema
  await sql`
    CREATE TABLE IF NOT EXISTS kysely_migration (
      name VARCHAR(255) PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL
    )
  `.execute(db);

  // Fix schema if needed
  const columnInfo = await sql`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'kysely_migration' 
    AND column_name = 'timestamp'
  `.execute(db);

  const dataType = (columnInfo.rows[0] as any)?.data_type;
  if (dataType && dataType !== 'timestamp with time zone' && dataType !== 'timestamptz') {
    console.log(`⚠️  Fixing migration table schema (converting from ${dataType} to timestamptz)...`);
    await fixMigrationTableSchema();
    console.log('✅ Fixed migration table schema\n');
  }

  // List all migrations
  const migrations = await sql`
    SELECT name, timestamp 
    FROM kysely_migration 
    ORDER BY timestamp
  `.execute(db);

  console.log('📋 Current migrations:');
  migrations.rows.forEach((row: any) => {
    console.log(`  ${row.name} - ${row.timestamp}`);
  });

  // Remove invalid entries (not matching migration file names)
  const files = await fs.readdir(__dirname);
  const migrationFiles = files
    .filter((file) => /^\d{3}_.*\.ts$/.test(file) && file !== 'runner.ts')
    .map((file) => file.replace(/\.ts$/, ''));

  console.log('\n📁 Migration files found:');
  migrationFiles.forEach((file) => {
    console.log(`  ${file}`);
  });
  
  const invalidMigrations = migrations.rows.filter(
    (row: any) => !migrationFiles.includes(row.name)
  );

  if (invalidMigrations.length > 0) {
    console.log('\n⚠️  Removing invalid migration entries:');
    for (const row of invalidMigrations) {
      await sql`
        DELETE FROM kysely_migration WHERE name = ${(row as any).name}
      `.execute(db);
      console.log(`  ❌ Removed: ${(row as any).name}`);
    }
  } else {
    console.log('\n✅ No invalid migrations found');
  }

  // List final state
  const finalMigrations = await sql`
    SELECT name, timestamp 
    FROM kysely_migration 
    ORDER BY timestamp
  `.execute(db);

  console.log('\n📋 Final migrations:');
  finalMigrations.rows.forEach((row: any) => {
    console.log(`  ✅ ${row.name} - ${row.timestamp}`);
  });
}

/**
 * Verify specific migrations
 */
async function verify(type: string) {
  if (type === 'jikan') {
    console.log('🔍 Verifying Jikan migration...\n');

    const requiredColumns = ['mal_id', 'anilist_id', 'data_source', 'title_english', 'title_japanese'];
    const requiredIndexes = ['idx_content_mal_id', 'idx_content_data_source', 'idx_content_tmdb_mal'];

    // Check columns
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'content'
    `.execute(db);

    const columnNames = columns.rows.map((r: any) => r.column_name);
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));

    // Check if tmdb_id is nullable
    const tmdbIdInfo = await sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'content' 
      AND column_name = 'tmdb_id'
    `.execute(db);

    const tmdbIdNullable = (tmdbIdInfo.rows[0] as any)?.is_nullable === 'YES';

    // Check indexes
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'content'
    `.execute(db);

    const indexNames = indexes.rows.map((r: any) => r.indexname);
    const missingIndexes = requiredIndexes.filter(idx => !indexNames.includes(idx));

    console.log('📋 Column check:');
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });

    console.log(`\n📋 tmdb_id nullable: ${tmdbIdNullable ? '✅' : '❌'}`);

    console.log('\n📋 Index check:');
    requiredIndexes.forEach(idx => {
      const exists = indexNames.includes(idx);
      console.log(`  ${exists ? '✅' : '❌'} ${idx}`);
    });

    const allGood = missingColumns.length === 0 && 
                    tmdbIdNullable && 
                    missingIndexes.length === 0;
    
    if (allGood) {
      console.log('\n✅ Jikan migration is complete!');
    } else {
      console.log('\n⚠️  Migration is incomplete!');
      if (missingColumns.length > 0) {
        console.log('Missing columns:', missingColumns.join(', '));
      }
      if (!tmdbIdNullable) {
        console.log('tmdb_id is not nullable');
      }
      if (missingIndexes.length > 0) {
        console.log('Missing indexes:', missingIndexes.join(', '));
      }
      console.log('\nRun: pnpm run migrate:up');
      process.exit(1);
    }
  } else {
    console.error(`❌ Unknown verification type: ${type}`);
    console.error('Available types: jikan');
  }
}

/**
 * Fix migration table schema (convert from bigint to timestamptz)
 */
async function fixMigrationTableSchema() {
  const existing = await sql`SELECT name, timestamp FROM kysely_migration`.execute(db);
  await sql`DROP TABLE kysely_migration`.execute(db);
  await sql`
    CREATE TABLE kysely_migration (
      name VARCHAR(255) PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL
    )
  `.execute(db);
  
  // Re-insert with converted timestamps
  for (const row of existing.rows) {
    const name = (row as any).name;
    let timestamp: Date;
    
    try {
      const rawTimestamp = (row as any).timestamp;
      
      if (rawTimestamp === null || rawTimestamp === undefined) {
        timestamp = new Date();
      } else if (rawTimestamp instanceof Date) {
        timestamp = rawTimestamp;
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } else if (typeof rawTimestamp === 'string') {
        const parsed = new Date(rawTimestamp);
        timestamp = isNaN(parsed.getTime()) ? new Date() : parsed;
      } else if (typeof rawTimestamp === 'number' || typeof rawTimestamp === 'bigint') {
        const numValue = Number(rawTimestamp);
        if (isNaN(numValue) || !isFinite(numValue) || numValue <= 0) {
          timestamp = new Date();
        } else {
          timestamp = new Date(numValue);
          if (isNaN(timestamp.getTime())) {
            timestamp = new Date();
          }
        }
      } else {
        timestamp = new Date();
      }
    } catch (error) {
      timestamp = new Date();
    }
    
    if (isNaN(timestamp.getTime())) {
      timestamp = new Date();
    }
    
    await sql`
      INSERT INTO kysely_migration (name, timestamp) 
      VALUES (${name}, ${timestamp})
    `.execute(db);
  }
}

main();


