import { Kysely, sql } from 'kysely';

/**
 * Migration: Add user "lists" (collections) of content.
 *
 * - `lists`: a named, optionally-ranked collection owned by a user.
 * - `list_items`: ordered members of a list, each referencing `content.id`
 *   (the app's single cross-source identity — TMDB/Jikan/AniList/Kitsu all
 *   resolve to one content row), mirroring how `queue`/`user_library` work.
 *
 * RLS policies follow the same `user_isolation` shape as 014_add_rls_policies:
 * - `lists` is a direct user_id table.
 * - `list_items` is indirect (owned via list_id -> lists.user_id).
 */

export async function up(db: Kysely<any>): Promise<void> {
  // lists
  await db.schema
    .createTable('lists')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('ranked', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('lists_user_id_idx').on('lists').column('user_id').execute();

  // list_items
  await db.schema
    .createTable('list_items')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('list_id', 'uuid', (col) => col.notNull().references('lists.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // One row per (list, content); fast ordered reads per list.
  await db.schema
    .createIndex('list_items_list_id_content_id_unique')
    .on('list_items')
    .columns(['list_id', 'content_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('list_items_list_id_position_idx')
    .on('list_items')
    .columns(['list_id', 'position'])
    .execute();

  // --- RLS (mirror 014_add_rls_policies user_isolation) ---
  await sql.raw(`ALTER TABLE lists ENABLE ROW LEVEL SECURITY`).execute(db);
  await sql.raw(`ALTER TABLE list_items ENABLE ROW LEVEL SECURITY`).execute(db);

  // lists: direct user_id ownership
  await sql.raw(`
    CREATE POLICY user_isolation ON lists
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

  // list_items: indirect ownership via list_id -> lists.user_id
  await sql.raw(`
    CREATE POLICY user_isolation ON list_items
    FOR ALL
    USING (
      list_id IN (
        SELECT id FROM lists
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
      list_id IN (
        SELECT id FROM lists
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
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP POLICY IF EXISTS user_isolation ON list_items`.execute(db);
  await sql`DROP POLICY IF EXISTS user_isolation ON lists`.execute(db);
  await db.schema.dropTable('list_items').execute();
  await db.schema.dropTable('lists').execute();
}
