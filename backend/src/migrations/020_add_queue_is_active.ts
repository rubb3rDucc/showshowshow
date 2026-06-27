import { Kysely } from 'kysely';

/**
 * Per-item "schedule this?" flag on the lineup. When false, the item stays in the
 * queue but the schedule generator skips it. Defaults true so existing items are
 * unaffected.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('queue')
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('queue').dropColumn('is_active').execute();
}
