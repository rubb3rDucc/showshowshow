import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Verify that the Jikan migration (003_add_jikan_support) was applied correctly
 */
async function verifyMigration() {
  console.log('🔍 Verifying Jikan migration...');

  try {
    // Check columns
    const columns = await sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'content' 
      AND column_name IN ('mal_id', 'anilist_id', 'data_source', 'title_english', 'title_japanese', 'tmdb_id')
      ORDER BY column_name
    `.execute(db);

    const columnNames = columns.rows.map((row: any) => row.column_name);
    const requiredColumns = ['mal_id', 'anilist_id', 'data_source', 'title_english', 'title_japanese'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    const tmdbIdNullable = columns.rows.find((row: any) => row.column_name === 'tmdb_id')?.is_nullable === 'YES';

    console.log('\n📋 Columns:');
    requiredColumns.forEach(col => {
      console.log(`  ${columnNames.includes(col) ? '✅' : '❌'} ${col}`);
    });
    console.log(`  ${tmdbIdNullable ? '✅' : '❌'} tmdb_id is nullable`);

    // Check indexes
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'content' 
      AND indexname IN ('idx_content_mal_id', 'idx_content_data_source', 'idx_content_tmdb_mal')
    `.execute(db);
    
    const indexNames = indexes.rows.map((row: any) => row.indexname);
    const requiredIndexes = ['idx_content_mal_id', 'idx_content_data_source', 'idx_content_tmdb_mal'];
    
    console.log('\n📋 Indexes:');
    requiredIndexes.forEach(idx => {
      console.log(`  ${indexNames.includes(idx) ? '✅' : '❌'} ${idx}`);
    });

    // Summary
    const allGood = missingColumns.length === 0 && tmdbIdNullable && 
                    requiredIndexes.every(idx => indexNames.includes(idx));
    
    if (allGood) {
      console.log('\n✅ Jikan migration is complete!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration is incomplete!');
      if (missingColumns.length > 0) {
        console.log('Missing columns:', missingColumns.join(', '));
      }
      if (!tmdbIdNullable) {
        console.log('tmdb_id is not nullable');
      }
      const missingIndexes = requiredIndexes.filter(idx => !indexNames.includes(idx));
      if (missingIndexes.length > 0) {
        console.log('Missing indexes:', missingIndexes.join(', '));
      }
      console.log('\nRun: pnpm exec tsx src/migrations/runner.ts up');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

verifyMigration();

