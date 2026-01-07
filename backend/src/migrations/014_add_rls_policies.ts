import { Kysely, sql } from 'kysely';

/**
 * Migration: Add Row Level Security (RLS) policies
 *
 * This enables database-level access control using PostgreSQL RLS.
 * Policies check the session variable 'app.current_user_id' which is set
 * by the RLS context plugin for each authenticated request.
 *
 * Policy logic:
 * - User can access their own data (user_id matches context)
 * - System account (all zeros UUID) can access all data (for webhooks)
 * - Admin users can access all data (for support/debugging)
 */

// Tables with direct user_id column
const DIRECT_USER_TABLES = [
  'queue',
  'schedule',
  'watch_history',
  'programming_blocks',
  'rotation_groups',
  'user_library',
  'library_episode_status',
  'user_preferences',
  'sync_metadata',
];

// Tables with indirect user relationship
const INDIRECT_TABLES = ['block_content', 'rotation_content'];

export async function up(db: Kysely<any>): Promise<void> {
  // Enable RLS on all user-specific tables
  for (const table of DIRECT_USER_TABLES) {
    await sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`).execute(db);
  }

  for (const table of INDIRECT_TABLES) {
    await sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`).execute(db);
  }

  // Create policies for direct user_id tables
  // Using sql.raw() to avoid parameter binding issues with CREATE POLICY
  for (const table of DIRECT_USER_TABLES) {
    await sql.raw(`
      CREATE POLICY user_isolation ON ${table}
      FOR ALL
      USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
        OR EXISTS (
          SELECT 1 FROM users
          WHERE id::text = current_setting('app.current_user_id', true)
          AND is_admin = true
        )
      )
      WITH CHECK (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
        OR EXISTS (
          SELECT 1 FROM users
          WHERE id::text = current_setting('app.current_user_id', true)
          AND is_admin = true
        )
      )
    `).execute(db);
  }

  // Create policies for indirect tables (block_content, rotation_content)
  await sql.raw(`
    CREATE POLICY user_isolation ON block_content
    FOR ALL
    USING (
      block_id IN (
        SELECT id FROM programming_blocks
        WHERE user_id::text = current_setting('app.current_user_id', true)
      )
      OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id::text = current_setting('app.current_user_id', true)
        AND is_admin = true
      )
    )
    WITH CHECK (
      block_id IN (
        SELECT id FROM programming_blocks
        WHERE user_id::text = current_setting('app.current_user_id', true)
      )
      OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id::text = current_setting('app.current_user_id', true)
        AND is_admin = true
      )
    )
  `).execute(db);

  await sql.raw(`
    CREATE POLICY user_isolation ON rotation_content
    FOR ALL
    USING (
      rotation_id IN (
        SELECT id FROM rotation_groups
        WHERE user_id::text = current_setting('app.current_user_id', true)
      )
      OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id::text = current_setting('app.current_user_id', true)
        AND is_admin = true
      )
    )
    WITH CHECK (
      rotation_id IN (
        SELECT id FROM rotation_groups
        WHERE user_id::text = current_setting('app.current_user_id', true)
      )
      OR current_setting('app.current_user_id', true) = '00000000-0000-0000-0000-000000000000'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id::text = current_setting('app.current_user_id', true)
        AND is_admin = true
      )
    )
  `).execute(db);

  console.log('RLS policies created for all user tables');
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop policies from all tables
  for (const table of DIRECT_USER_TABLES) {
    await sql`DROP POLICY IF EXISTS user_isolation ON ${sql.raw(table)}`.execute(db);
  }

  for (const table of INDIRECT_TABLES) {
    await sql`DROP POLICY IF EXISTS user_isolation ON ${sql.raw(table)}`.execute(db);
  }

  // Disable RLS on all tables
  for (const table of DIRECT_USER_TABLES) {
    await sql`ALTER TABLE ${sql.raw(table)} DISABLE ROW LEVEL SECURITY`.execute(db);
  }

  for (const table of INDIRECT_TABLES) {
    await sql`ALTER TABLE ${sql.raw(table)} DISABLE ROW LEVEL SECURITY`.execute(db);
  }

  console.log('RLS policies removed from all user tables');
}
