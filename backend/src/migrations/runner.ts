import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider, Migration } from 'kysely';
import { db } from '../db/index.js';
import { sql } from 'kysely';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure migration table has correct schema before running migrations
// Kysely's Migrator expects timestamptz, not bigint
async function ensureMigrationTableSchema() {
  // Check if table exists
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'kysely_migration'
    )
  `.execute(db);

  const exists = (tableExists.rows[0] as any)?.exists;

  if (!exists) {
    // Create with timestamptz (Kysely's default)
    await sql`
      CREATE TABLE kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `.execute(db);
    console.log('✅ Created kysely_migration table with correct schema');
  } else {
    // Check and fix timestamp column type
    const columnInfo = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kysely_migration' 
      AND column_name = 'timestamp'
    `.execute(db);

    const dataType = (columnInfo.rows[0] as any)?.data_type;
    
    // Kysely expects timestamptz, not bigint
    if (dataType && dataType !== 'timestamp with time zone' && dataType !== 'timestamptz') {
      console.log(`⚠️  Fixing kysely_migration.timestamp column from ${dataType} to timestamptz...`);
      
      // Get existing data
      const existing = await sql`SELECT name, timestamp FROM kysely_migration`.execute(db);
      
      // Drop and recreate table
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
            console.warn(`  ⚠️  Null timestamp for ${name}, using current time`);
            timestamp = new Date();
          } else if (rawTimestamp instanceof Date) {
            timestamp = rawTimestamp;
            if (isNaN(timestamp.getTime())) {
              console.warn(`  ⚠️  Invalid Date object for ${name}, using current time`);
              timestamp = new Date();
            }
          } else if (typeof rawTimestamp === 'string') {
            const parsed = new Date(rawTimestamp);
            if (isNaN(parsed.getTime())) {
              console.warn(`  ⚠️  Invalid date string "${rawTimestamp}" for ${name}, using current time`);
              timestamp = new Date();
            } else {
              timestamp = parsed;
            }
          } else if (typeof rawTimestamp === 'number' || typeof rawTimestamp === 'bigint') {
            // Convert bigint/number (milliseconds) to Date
            const numValue = Number(rawTimestamp);
            if (isNaN(numValue) || !isFinite(numValue) || numValue <= 0) {
              console.warn(`  ⚠️  Invalid number ${rawTimestamp} for ${name}, using current time`);
              timestamp = new Date();
            } else {
              timestamp = new Date(numValue);
              if (isNaN(timestamp.getTime())) {
                console.warn(`  ⚠️  Invalid date from number ${rawTimestamp} for ${name}, using current time`);
                timestamp = new Date();
              }
            }
          } else {
            console.warn(`  ⚠️  Unknown timestamp type ${typeof rawTimestamp} for ${name}, using current time`);
            timestamp = new Date();
          }
        } catch (error) {
          console.warn(`  ⚠️  Error converting timestamp for ${name}:`, error);
          timestamp = new Date();
        }
        
        // Final validation before inserting
        if (isNaN(timestamp.getTime())) {
          console.warn(`  ⚠️  Final validation failed for ${name}, using current time`);
          timestamp = new Date();
        }
        
        await sql`
          INSERT INTO kysely_migration (name, timestamp) 
          VALUES (${name}, ${timestamp})
        `.execute(db);
      }
      console.log('✅ Fixed kysely_migration table schema');
    }
  }
}

// Custom provider that only loads numbered migration files (e.g., 001_*.ts, 002_*.ts)
class NumberedMigrationProvider {
  constructor(
    private fs: typeof import('fs').promises,
    private path: typeof import('path'),
    private migrationFolder: string
  ) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const files = await this.fs.readdir(this.migrationFolder);
    const migrations: Record<string, Migration> = {};

    // Only load files that match the pattern: NNN_*.ts (numbered migrations)
    const migrationFiles = files.filter(
      (file) => /^\d{3}_.*\.ts$/.test(file) && file !== 'runner.ts'
    );

    for (const fileName of migrationFiles) {
      const migrationName = fileName.replace(/\.ts$/, '');
      const migrationPath = this.path.join(this.migrationFolder, fileName);
      const migration = await import(migrationPath);
      
      if (migration.up && migration.down) {
        migrations[migrationName] = {
          up: migration.up,
          down: migration.down,
        };
      }
    }

    return migrations;
  }
}

async function migrateToLatest() {
  console.log('🔄 Running migrations...');
  
  // Ensure migration table has correct schema first
  await ensureMigrationTableSchema();
  
  const migrator = new Migrator({
    db,
    provider: new NumberedMigrationProvider(
      fs,
      path,
      path.join(__dirname, './')
    ),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('❌ Migration failed:', error);
    
    // Check if this is a "table already exists" error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists') || errorMessage.includes('relation') && errorMessage.includes('already exists')) {
      console.error('\n💡 Tip: It looks like tables already exist but migrations aren\'t tracked.');
      console.error('   Run: pnpm exec tsx src/migrations/sync-migrations.ts');
      console.error('   This will detect existing tables and mark migrations as complete.\n');
    }
    
    await db.destroy();
    process.exit(1);
  }

  console.log('✅ All migrations completed successfully');
  await db.destroy();
  process.exit(0);
}

async function migrateDown() {
  console.log('🔄 Rolling back last migration...');
  
  // Ensure migration table has correct schema first
  await ensureMigrationTableSchema();
  
  const migrator = new Migrator({
    db,
    provider: new NumberedMigrationProvider(
      fs,
      path,
      path.join(__dirname, './')
    ),
  });

  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was rolled back successfully`);
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to roll back migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('❌ Rollback failed:', error);
    await db.destroy();
    process.exit(1);
  }

  console.log('✅ Rollback completed successfully');
  await db.destroy();
  process.exit(0);
}

// Run based on command line argument
const command = process.argv[2];

if (command === 'up') {
  migrateToLatest();
} else if (command === 'down') {
  migrateDown();
} else {
  console.error('Usage: tsx src/migrations/runner.ts [up|down]');
  process.exit(1);
}

