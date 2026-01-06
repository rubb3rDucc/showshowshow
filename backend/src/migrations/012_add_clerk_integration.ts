import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add clerk_user_id column to users table
  await db.schema
    .alterTable('users')
    .addColumn('clerk_user_id', 'text')
    .execute();

  // Create unique constraint on clerk_user_id
  await db.schema
    .createIndex('users_clerk_user_id_unique')
    .on('users')
    .column('clerk_user_id')
    .unique()
    .execute();

  // Create regular index for lookups
  await db.schema
    .createIndex('users_clerk_user_id_idx')
    .on('users')
    .column('clerk_user_id')
    .execute();

  // Make password_hash nullable (OAuth users won't have passwords)
  // Use raw SQL since Kysely's alterColumn doesn't support DROP NOT NULL
  await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`.execute(db);

  // Add auth_provider column with default 'jwt'
  await db.schema
    .alterTable('users')
    .addColumn('auth_provider', 'text', (col) => col.defaultTo('jwt').notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop auth_provider column
  await db.schema
    .alterTable('users')
    .dropColumn('auth_provider')
    .execute();

  // Restore password_hash to not null (will fail if any null values exist)
  // Use raw SQL since Kysely's alterColumn doesn't support SET NOT NULL
  await sql`ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL`.execute(db);

  // Drop clerk_user_id indexes
  await db.schema
    .dropIndex('users_clerk_user_id_idx')
    .execute();

  await db.schema
    .dropIndex('users_clerk_user_id_unique')
    .execute();

  // Drop clerk_user_id column
  await db.schema
    .alterTable('users')
    .dropColumn('clerk_user_id')
    .execute();
}
