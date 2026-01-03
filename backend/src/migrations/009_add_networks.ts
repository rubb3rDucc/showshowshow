import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create networks table
  await db.schema
    .createTable('networks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`)
    )
    .addColumn('tmdb_network_id', 'integer', (col) => col.unique())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('logo_path', 'text')
    .addColumn('origin_country', 'varchar(10)')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create indexes
  await db.schema
    .createIndex('idx_networks_tmdb_id')
    .on('networks')
    .column('tmdb_network_id')
    .execute();

  await db.schema
    .createIndex('idx_networks_name')
    .on('networks')
    .column('name')
    .execute();

  // Create content_networks mapping table (many-to-many)
  await db.schema
    .createTable('content_networks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`)
    )
    .addColumn('content_id', 'uuid', (col) =>
      col.notNull().references('content.id').onDelete('cascade')
    )
    .addColumn('network_id', 'uuid', (col) =>
      col.notNull().references('networks.id').onDelete('cascade')
    )
    .addColumn('is_original', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create unique constraint
  await db.schema
    .createIndex('idx_content_networks_unique')
    .on('content_networks')
    .columns(['content_id', 'network_id'])
    .unique()
    .execute();

  // Create indexes for foreign keys
  await db.schema
    .createIndex('idx_content_networks_content_id')
    .on('content_networks')
    .column('content_id')
    .execute();

  await db.schema
    .createIndex('idx_content_networks_network_id')
    .on('content_networks')
    .column('network_id')
    .execute();

  console.log('✅ Migration 009: Networks tables created successfully');
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('content_networks').ifExists().execute();
  await db.schema.dropTable('networks').ifExists().execute();
  
  console.log('✅ Migration 009: Networks tables dropped successfully');
}


