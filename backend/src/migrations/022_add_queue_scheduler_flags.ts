import { Kysely } from 'kysely';

/**
 * Per-show scheduler flags on the lineup (queue) item. These are per-show decisions
 * the generator honors when building a schedule:
 *  - include_watched: also schedule episodes the user has already watched
 *  - episode_order: play this show's episodes 'sequential' (in order) or 'shuffle'
 *  - resume_from_last_watched: start after the show's latest watched episode
 * Defaults preserve current behavior (unwatched-only, shuffled, no resume).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('queue')
    .addColumn('include_watched', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('episode_order', 'text', (col) => col.notNull().defaultTo('shuffle'))
    .addColumn('resume_from_last_watched', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('queue')
    .dropColumn('include_watched')
    .dropColumn('episode_order')
    .dropColumn('resume_from_last_watched')
    .execute();
}