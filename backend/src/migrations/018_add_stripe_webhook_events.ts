import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create stripe_webhook_events table for idempotency tracking
  await db.schema
    .createTable('stripe_webhook_events')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('stripe_event_id', 'text', (col) => col.notNull())
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('processed_at', 'timestamptz', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create unique index on stripe_event_id for idempotency
  await db.schema
    .createIndex('stripe_webhook_events_stripe_event_id_unique')
    .on('stripe_webhook_events')
    .column('stripe_event_id')
    .unique()
    .execute();

  // Create index on event_type for filtering
  await db.schema
    .createIndex('stripe_webhook_events_event_type_idx')
    .on('stripe_webhook_events')
    .column('event_type')
    .execute();

  // Create index on created_at for cleanup queries
  await db.schema
    .createIndex('stripe_webhook_events_created_at_idx')
    .on('stripe_webhook_events')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema
    .dropIndex('stripe_webhook_events_created_at_idx')
    .execute();

  await db.schema.dropIndex('stripe_webhook_events_event_type_idx').execute();

  await db.schema
    .dropIndex('stripe_webhook_events_stripe_event_id_unique')
    .execute();

  // Drop the table
  await db.schema.dropTable('stripe_webhook_events').execute();
}
