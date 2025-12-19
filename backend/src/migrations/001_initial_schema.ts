import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);

  // Check if users table exists (idempotency check)
  const usersExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `.execute(db);

  if ((usersExists.rows[0] as any)?.exists) {
    console.log('⚠️  Users table already exists, skipping 001_initial_schema');
    return;
  }

  // Create users table
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create content table
  await db.schema
    .createTable('content')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('tmdb_id', 'integer', (col) => col.notNull())
    .addColumn('content_type', 'varchar(10)', (col) => col.notNull())
    .addColumn('title', 'varchar(500)', (col) => col.notNull())
    .addColumn('poster_url', 'text')
    .addColumn('backdrop_url', 'text')
    .addColumn('overview', 'text')
    .addColumn('release_date', 'date')
    .addColumn('first_air_date', 'date')
    .addColumn('last_air_date', 'date')
    .addColumn('default_duration', 'integer', (col) => col.notNull().defaultTo(30))
    .addColumn('number_of_seasons', 'integer')
    .addColumn('number_of_episodes', 'integer')
    .addColumn('status', 'varchar(50)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_content_tmdb_id')
    .on('content')
    .columns(['tmdb_id', 'content_type'])
    .unique()
    .execute();

  // Create episodes table
  await db.schema
    .createTable('episodes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('season', 'integer', (col) => col.notNull())
    .addColumn('episode_number', 'integer', (col) => col.notNull())
    .addColumn('title', 'varchar(500)')
    .addColumn('overview', 'text')
    .addColumn('duration', 'integer', (col) => col.notNull().defaultTo(30))
    .addColumn('air_date', 'date')
    .addColumn('still_url', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_episodes_content_id')
    .on('episodes')
    .column('content_id')
    .execute();

  await db.schema
    .createIndex('idx_episodes_content_season_episode')
    .on('episodes')
    .columns(['content_id', 'season', 'episode_number'])
    .unique()
    .execute();

  // Create watch_history table
  await db.schema
    .createTable('watch_history')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('season', 'integer')
    .addColumn('episode', 'integer')
    .addColumn('watched_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('rewatch_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('synced', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_watch_history_user_id')
    .on('watch_history')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_watch_history_content_id')
    .on('watch_history')
    .column('content_id')
    .execute();

  // Create schedule table
  await db.schema
    .createTable('schedule')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('season', 'integer')
    .addColumn('episode', 'integer')
    .addColumn('scheduled_time', 'timestamptz', (col) => col.notNull())
    .addColumn('duration', 'integer', (col) => col.notNull())
    .addColumn('source_type', 'varchar(20)', (col) => col.notNull().defaultTo('manual'))
    .addColumn('source_id', 'uuid')
    .addColumn('watched', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('synced', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_schedule_user_id')
    .on('schedule')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_schedule_scheduled_time')
    .on('schedule')
    .column('scheduled_time')
    .execute();

  await db.schema
    .createIndex('idx_schedule_user_time')
    .on('schedule')
    .columns(['user_id', 'scheduled_time'])
    .execute();

  // Create queue table
  await db.schema
    .createTable('queue')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('season', 'integer')
    .addColumn('episode', 'integer')
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('synced', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_queue_user_id')
    .on('queue')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_queue_user_position')
    .on('queue')
    .columns(['user_id', 'position'])
    .execute();

  // Create programming_blocks table
  await db.schema
    .createTable('programming_blocks')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('block_type', 'varchar(20)', (col) => col.notNull().defaultTo('custom'))
    .addColumn('criteria', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('schedule_days', sql`text[]`, (col) => col.notNull().defaultTo(sql`ARRAY[]::text[]`))
    .addColumn('start_time', 'time')
    .addColumn('end_time', 'time')
    .addColumn('rotation_type', 'varchar(20)', (col) => col.notNull().defaultTo('sequential'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_programming_blocks_user_id')
    .on('programming_blocks')
    .column('user_id')
    .execute();

  // Create block_content table
  await db.schema
    .createTable('block_content')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('block_id', 'uuid', (col) => col.notNull().references('programming_blocks.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('time_slot', 'time')
    .addColumn('duration', 'integer')
    .addColumn('current_season', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('current_episode', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_block_content_block_id')
    .on('block_content')
    .column('block_id')
    .execute();

  // Create rotation_groups table
  await db.schema
    .createTable('rotation_groups')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'varchar(255)')
    .addColumn('rotation_type', 'varchar(20)', (col) => col.notNull().defaultTo('round_robin'))
    .addColumn('max_consecutive', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_rotation_groups_user_id')
    .on('rotation_groups')
    .column('user_id')
    .execute();

  // Create rotation_content table
  await db.schema
    .createTable('rotation_content')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('rotation_id', 'uuid', (col) => col.notNull().references('rotation_groups.id').onDelete('cascade'))
    .addColumn('content_id', 'uuid', (col) => col.notNull().references('content.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('current_season', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('current_episode', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('idx_rotation_content_rotation_id')
    .on('rotation_content')
    .column('rotation_id')
    .execute();

  // Create user_preferences table
  await db.schema
    .createTable('user_preferences')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().unique().references('users.id').onDelete('cascade'))
    .addColumn('include_reruns', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('rerun_frequency', 'varchar(20)', (col) => col.notNull().defaultTo('rarely'))
    .addColumn('max_shows_per_time_slot', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('time_slot_duration', 'integer', (col) => col.notNull().defaultTo(30))
    .addColumn('allow_overlap', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('default_start_time', 'time')
    .addColumn('default_end_time', 'time')
    .addColumn('onboarding_completed', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create sync_metadata table
  await db.schema
    .createTable('sync_metadata')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().unique().references('users.id').onDelete('cascade'))
    .addColumn('last_sync_time', 'timestamptz')
    .addColumn('sync_token', 'text')
    .addColumn('device_id', 'varchar(255)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create trigger function for updated_at
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `.execute(db);

  // Add triggers to tables with updated_at
  const tablesWithUpdatedAt = ['users', 'content', 'programming_blocks', 'user_preferences', 'sync_metadata'];
  
  for (const table of tablesWithUpdatedAt) {
    await sql`
      CREATE TRIGGER update_${sql.raw(table)}_updated_at
      BEFORE UPDATE ON ${sql.table(table)}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order (respecting foreign key constraints)
  await db.schema.dropTable('sync_metadata').ifExists().execute();
  await db.schema.dropTable('user_preferences').ifExists().execute();
  await db.schema.dropTable('rotation_content').ifExists().execute();
  await db.schema.dropTable('rotation_groups').ifExists().execute();
  await db.schema.dropTable('block_content').ifExists().execute();
  await db.schema.dropTable('programming_blocks').ifExists().execute();
  await db.schema.dropTable('queue').ifExists().execute();
  await db.schema.dropTable('schedule').ifExists().execute();
  await db.schema.dropTable('watch_history').ifExists().execute();
  await db.schema.dropTable('episodes').ifExists().execute();
  await db.schema.dropTable('content').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();

  // Drop trigger function
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db);
}

