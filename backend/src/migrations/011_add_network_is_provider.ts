import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add is_provider column to networks table
  await db.schema
    .alterTable('networks')
    .addColumn('is_provider', 'boolean', (col) => col.defaultTo(false).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('networks')
    .dropColumn('is_provider')
    .execute();
}

