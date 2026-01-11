import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create stripe_subscriptions table
  await db.schema
    .createTable('stripe_subscriptions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('stripe_subscription_id', 'text', (col) => col.notNull())
    .addColumn('stripe_customer_id', 'text', (col) => col.notNull())
    .addColumn('stripe_price_id', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('current_period_start', 'timestamptz', (col) => col.notNull())
    .addColumn('current_period_end', 'timestamptz', (col) => col.notNull())
    .addColumn('cancel_at_period_end', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('canceled_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create unique index on stripe_subscription_id
  await db.schema
    .createIndex('stripe_subscriptions_stripe_subscription_id_unique')
    .on('stripe_subscriptions')
    .column('stripe_subscription_id')
    .unique()
    .execute();

  // Create index on user_id for lookups
  await db.schema
    .createIndex('stripe_subscriptions_user_id_idx')
    .on('stripe_subscriptions')
    .column('user_id')
    .execute();

  // Create index on stripe_customer_id for webhook lookups
  await db.schema
    .createIndex('stripe_subscriptions_stripe_customer_id_idx')
    .on('stripe_subscriptions')
    .column('stripe_customer_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema
    .dropIndex('stripe_subscriptions_stripe_customer_id_idx')
    .execute();

  await db.schema.dropIndex('stripe_subscriptions_user_id_idx').execute();

  await db.schema
    .dropIndex('stripe_subscriptions_stripe_subscription_id_unique')
    .execute();

  // Drop the table
  await db.schema.dropTable('stripe_subscriptions').execute();
}
