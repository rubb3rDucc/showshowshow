import { Kysely, sql } from 'kysely';

/**
 * Migration: Add deleted_users audit table for GDPR compliance
 *
 * This table permanently records deleted users to ensure they are never
 * restored from database backups (GDPR "right to be forgotten" compliance)
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create deleted_users audit table
  await db.schema
    .createTable('deleted_users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('clerk_user_id', 'text', (col) => col.notNull().unique())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('deleted_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('deleted_reason', 'text', (col) => col.notNull())
    .addColumn('stripe_customer_id', 'text')
    .addColumn('stripe_subscription_id', 'text')
    .addColumn('had_active_subscription', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .execute();

  // Index for fast lookups during cleanup
  await db.schema
    .createIndex('deleted_users_clerk_id_idx')
    .on('deleted_users')
    .column('clerk_user_id')
    .execute();

  // Index for querying by deletion date
  await db.schema
    .createIndex('deleted_users_deleted_at_idx')
    .on('deleted_users')
    .column('deleted_at')
    .execute();

  console.log('✅ Created deleted_users audit table');
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('deleted_users').execute();
  console.log('✅ Dropped deleted_users audit table');
}
