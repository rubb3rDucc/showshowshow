import { Kysely, sql } from 'kysely';

/**
 * A shared read-through cache for results built from third-party APIs, so a
 * provider is hit once per key rather than on every view, and copies survive
 * deploys. Keys are namespaced by provider and kind ("anime:detail:52991",
 * "mal-title:manga:126287"); each caller picks its own max age when reading
 * (see lib/api-cache.ts). TMDB data must stay under TMDB's 6-month limit.
 * Shared cache like `content`, so no RLS.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('api_cache')
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'jsonb', (col) => col.notNull())
    .addColumn('fetched_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // For sweeping old entries by age
  await db.schema.createIndex('api_cache_fetched_at_idx').on('api_cache').column('fetched_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('api_cache').ifExists().execute();
}
