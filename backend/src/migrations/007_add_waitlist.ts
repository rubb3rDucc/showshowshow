import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if waitlist table already exists
  const waitlistExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'waitlist'
    )
  `.execute(db);

  if ((waitlistExists.rows[0] as any)?.exists) {
    console.log('⚠️  Waitlist table already exists, skipping 007_add_waitlist');
    return;
  }

  // Create waitlist table
  await db.schema
    .createTable('waitlist')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('discount_code', 'varchar(50)') // NULL until code is generated
    .addColumn('code_sent_at', 'timestamptz') // When you sent the code
    .addColumn('code_used', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('code_used_at', 'timestamptz')
    .addColumn('source', 'varchar(50)') // 'landing_page', 'beta_invite', etc.
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Indexes for quick lookups
  await sql`CREATE INDEX idx_waitlist_email ON waitlist(email)`.execute(db);
  await sql`CREATE INDEX idx_waitlist_discount_code ON waitlist(discount_code) WHERE discount_code IS NOT NULL`.execute(db);
  await sql`CREATE INDEX idx_waitlist_created_at ON waitlist(created_at DESC)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('waitlist').execute();
}


