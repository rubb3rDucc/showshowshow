import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Clean up invalid entries from kysely_migration table
 * Also fixes migration table schema if needed
 */
async function cleanMigrationTable() {
  console.log('🔄 Cleaning kysely_migration table...');

  try {
    // Ensure table exists with correct schema
    await sql`
      CREATE TABLE IF NOT EXISTS kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp BIGINT NOT NULL
      )
    `.execute(db);

    // Fix schema if it's using timestamptz instead of bigint
    const columnInfo = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kysely_migration' 
      AND column_name = 'timestamp'
    `.execute(db);

    const dataType = (columnInfo.rows[0] as any)?.data_type;
    if (dataType && dataType !== 'bigint') {
      console.log('⚠️  Fixing migration table schema (converting to bigint)...');
      const existing = await sql`SELECT name, timestamp FROM kysely_migration`.execute(db);
      await sql`DROP TABLE kysely_migration`.execute(db);
      await sql`
        CREATE TABLE kysely_migration (
          name VARCHAR(255) PRIMARY KEY,
          timestamp BIGINT NOT NULL
        )
      `.execute(db);
      
      // Re-insert with converted timestamps
      for (const row of existing.rows) {
        const name = (row as any).name;
        const timestamp = typeof (row as any).timestamp === 'number' 
          ? (row as any).timestamp 
          : Date.now();
        await sql`
          INSERT INTO kysely_migration (name, timestamp) 
          VALUES (${name}, ${timestamp})
        `.execute(db);
      }
      console.log('✅ Fixed migration table schema');
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
      console.log(`  ${row.name} - ${date.toISOString()}`);
    });

    // Remove invalid entries (not matching migration file names)
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
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

cleanMigrationTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

