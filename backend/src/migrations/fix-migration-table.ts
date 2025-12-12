import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Fix the kysely_migration table schema to use bigint instead of timestamptz
 */
async function fixMigrationTable() {
  console.log('🔄 Fixing kysely_migration table schema...');

  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kysely_migration'
      )
    `.execute(db);

    const exists = (tableExists.rows[0] as any)?.exists;

    if (exists) {
      // Check current column type
      const columnInfo = await sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'kysely_migration' 
        AND column_name = 'timestamp'
      `.execute(db);

      const dataType = (columnInfo.rows[0] as any)?.data_type;
      console.log(`Current timestamp column type: ${dataType}`);

      if (dataType !== 'bigint') {
        console.log('⚠️  Converting timestamp column to bigint...');
        
        // Get existing data
        const existing = await sql`
          SELECT name, timestamp 
          FROM kysely_migration
        `.execute(db);

        // Drop and recreate table with correct schema
        await sql`DROP TABLE kysely_migration`.execute(db);
        await sql`
          CREATE TABLE kysely_migration (
            name VARCHAR(255) PRIMARY KEY,
            timestamp BIGINT NOT NULL
          )
        `.execute(db);

        // Re-insert data with converted timestamps
        for (const row of existing.rows) {
          const name = (row as any).name;
          let timestamp: number;
          
          if (dataType === 'timestamp with time zone' || dataType === 'timestamptz') {
            // Convert timestamptz to bigint (milliseconds since epoch)
            const tsResult = await sql`
              SELECT EXTRACT(EPOCH FROM ${(row as any).timestamp}::timestamptz)::BIGINT * 1000 as ms
            `.execute(db);
            timestamp = Number((tsResult.rows[0] as any)?.ms || Date.now());
          } else if (typeof (row as any).timestamp === 'number') {
            timestamp = (row as any).timestamp;
          } else {
            timestamp = Date.now();
          }

          await sql`
            INSERT INTO kysely_migration (name, timestamp) 
            VALUES (${name}, ${timestamp})
          `.execute(db);
        }

        console.log('✅ Converted kysely_migration table to use bigint timestamps');
      } else {
        console.log('✅ kysely_migration table already has correct schema');
      }
    } else {
      // Create table with correct schema
      await sql`
        CREATE TABLE kysely_migration (
          name VARCHAR(255) PRIMARY KEY,
          timestamp BIGINT NOT NULL
        )
      `.execute(db);
      console.log('✅ Created kysely_migration table with correct schema');
    }

    // Verify
    const verify = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kysely_migration'
    `.execute(db);

    console.log('\n📋 kysely_migration table schema:');
    verify.rows.forEach((row: any) => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

fixMigrationTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

