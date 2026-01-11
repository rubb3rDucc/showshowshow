import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create user_entitlements table
  await db.schema
    .createTable('user_entitlements')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('users.id').onDelete('cascade')
    )
    .addColumn('plan', 'text', (col) => col.notNull().defaultTo('preview'))
    .addColumn('preview_expires_at', 'timestamptz')
    .addColumn('pro_expires_at', 'timestamptz')
    .addColumn('stripe_customer_id', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create unique index on stripe_customer_id
  await db.schema
    .createIndex('user_entitlements_stripe_customer_id_unique')
    .on('user_entitlements')
    .column('stripe_customer_id')
    .unique()
    .execute();

  // Backfill existing users with 7-day preview trial
  // Trial starts from their account creation date
  await sql`
    INSERT INTO user_entitlements (user_id, plan, preview_expires_at, created_at, updated_at)
    SELECT
      id,
      'preview',
      created_at + INTERVAL '7 days',
      now(),
      now()
    FROM users
    WHERE id NOT IN (SELECT user_id FROM user_entitlements)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop the unique index
  await db.schema
    .dropIndex('user_entitlements_stripe_customer_id_unique')
    .execute();

  // Drop the table
  await db.schema.dropTable('user_entitlements').execute();
}
