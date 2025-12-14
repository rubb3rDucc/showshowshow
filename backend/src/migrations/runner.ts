import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider, Migration } from 'kysely';
import { db } from '../db/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

