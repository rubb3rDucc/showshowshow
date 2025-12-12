import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Clean up invalid entries from kysely_migration table
 */
async function cleanMigrationTable() {
  console.log('🔄 Cleaning kysely_migration table...');

  try {
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
    const validMigrations = ['001_initial_schema', '002_add_timezone_to_schedule'];
    const invalidMigrations = migrations.rows.filter(
      (row: any) => !validMigrations.includes(row.name)
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

