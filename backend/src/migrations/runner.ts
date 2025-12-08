import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { Database } from '../db/types.js';

dotenv.config();

const { Pool } = pg;

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
});

const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

// Create migrations table to track applied migrations
// async function ensureMigrationsTable() {
//   await db.schema
//     .createTable('kysely_migration')
//     .ifNotExists()
//     .addColumn('name', 'varchar(255)', (col) => col.primaryKey())
//     .addColumn('timestamp', 'bigint', (col) => col.notNull())
//     .execute();
// }

// // Get all migration files
// function getMigrationFiles(): string[] {
//   const migrationsDir = path.join(__dirname);
//   return fs
//     .readdirSync(migrationsDir)
//     .filter((file) => file.endsWith('.ts') && file !== 'runner.ts' && file.startsWith('0'))
//     .sort();
// }

// // Get applied migrations
// async function getAppliedMigrations(): Promise<string[]> {
//   try {
//     const rows = await db
//       .selectFrom('kysely_migration')
//       .select('name')
//       .execute();
//     return rows.map((row) => row.name);
//   } catch (error) {
//     // Table doesn't exist yet
//     return [];
//   }
// }

// // Run migrations
// async function runMigrations() {
//   await ensureMigrationsTable();
//   const applied = await getAppliedMigrations();
//   const files = getMigrationFiles();

//   console.log(`📦 Found ${files.length} migration(s)`);
//   console.log(`✅ ${applied.length} already applied`);

//   for (const file of files) {
//     if (applied.includes(file)) {
//       console.log(`⏭️  Skipping ${file} (already applied)`);
//       continue;
//     }

//     console.log(`🔄 Running migration: ${file}`);
//     const migrationPath = path.join(__dirname, file);
//     const migration = await import(`file://${migrationPath}`);
    
//     try {
//       await migration.up(db);
      
//       // Record migration
//       await db
//         .insertInto('kysely_migration')
//         .values({
//           name: file,
//           timestamp: Date.now(),
//         })
//         .execute();
      
//       console.log(`✅ Completed: ${file}`);
//     } catch (error) {
//       console.error(`❌ Failed: ${file}`, error);
//       throw error;
//     }
//   }

//   console.log('✅ All migrations completed');
// }

// // Rollback last migration
// async function rollbackLast() {
//   await ensureMigrationsTable();
//   const applied = await getAppliedMigrations();
  
//   if (applied.length === 0) {
//     console.log('No migrations to rollback');
//     return;
//   }

//   const lastMigration = applied[applied.length - 1];
//   console.log(`🔄 Rolling back: ${lastMigration}`);
  
//   const migrationPath = path.join(__dirname, lastMigration);
//   const migration = await import(`file://${migrationPath}`);
  
//   try {
//     await migration.down(db);
    
//     await db
//       .deleteFrom('kysely_migration')
//       .where('name', '=', lastMigration)
//       .execute();
    
//     console.log(`✅ Rolled back: ${lastMigration}`);
//   } catch (error) {
//     console.error(`❌ Rollback failed: ${lastMigration}`, error);
//     throw error;
//   }
// }

// // CLI
// const command = process.argv[2];

// if (command === 'up') {
//   runMigrations()
//     .then(() => {
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('❌ Migration failed:', error);
//       process.exit(1);
//     })
//     .finally(async () => {
//       await pool.end();
//     });
// } else if (command === 'down') {
//   rollbackLast()
//     .then(() => {
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('❌ Rollback failed:', error);
//       process.exit(1);
//     })
//     .finally(async () => {
//       await pool.end();
//     });
// } else {
//   console.log('Usage: pnpm run migrate:up | pnpm run migrate:down');
//   process.exit(1);
// }

