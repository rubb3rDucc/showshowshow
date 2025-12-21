import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if is_admin column already exists
  const columnExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'is_admin'
    )
  `.execute(db);

  if ((columnExists.rows[0] as any)?.exists) {
    console.log('⚠️  is_admin column already exists, skipping 008_add_admin_role');
    return;
  }

  // Add is_admin column to users table
  await db.schema
    .alterTable('users')
    .addColumn('is_admin', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Create index for admin lookups
  await sql`CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = true`.execute(db);

  console.log('✅ Added is_admin column to users table');
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('is_admin')
    .execute();
}

