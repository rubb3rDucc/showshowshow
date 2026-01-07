import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add sort_order column to networks table
  await db.schema
    .alterTable('networks')
    .addColumn('sort_order', 'integer', (col) => col.defaultTo(0).notNull())
    .execute();

  // Set initial sort_order based on name (alphabetical)
  await sql`
    UPDATE networks
    SET sort_order = row_number
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as row_number
      FROM networks
    ) as numbered
    WHERE networks.id = numbered.id
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('networks')
    .dropColumn('sort_order')
    .execute();
}



