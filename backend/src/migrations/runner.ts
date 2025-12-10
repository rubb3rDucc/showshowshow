import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider } from 'kysely';
import { db } from '../db/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateToLatest() {
  console.log('🔄 Running migrations...');
  
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, './'),
    }),
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
    await db.destroy();
    process.exit(1);
  }

  console.log('✅ All migrations completed successfully');
  await db.destroy();
  process.exit(0);
}

async function migrateDown() {
  console.log('🔄 Rolling back last migration...');
  
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, './'),
    }),
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

