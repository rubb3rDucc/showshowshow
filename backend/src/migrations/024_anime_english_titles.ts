import { Kysely, sql } from 'kysely';

/**
 * Brings anime rows cached before the detail page in line with how new ones
 * are stored (see anime-detail.ts):
 *
 * - Adds `content.original_title` and moves the romaji there, so `title` can be
 *   the English one without losing the name library search still matches on.
 * - Clears `backdrop_url` where it is just the portrait poster; the detail page
 *   falls back to a blurred poster and the next detail fetch fills in a real one.
 * - Strips MAL's "[Written by MAL Rewrite]" credit from synopses.
 *
 * Only `data_source = 'jikan'` rows change. User tables point at content.id,
 * which stays put.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('content').addColumn('original_title', 'text').execute();

  await sql`
    UPDATE content
    SET original_title = title,
        title = title_english,
        updated_at = now()
    WHERE data_source = 'jikan'
      AND title_english IS NOT NULL
      AND title_english <> ''
      AND title <> title_english
  `.execute(db);

  await sql`
    UPDATE content
    SET backdrop_url = NULL, updated_at = now()
    WHERE data_source = 'jikan' AND backdrop_url = poster_url
  `.execute(db);

  await sql`
    UPDATE content
    SET overview = NULLIF(btrim(regexp_replace(overview, '\\s*\\[Written by MAL Rewrite\\]\\s*$', '', 'i')), ''),
        updated_at = now()
    WHERE data_source = 'jikan' AND overview ~* '\\[Written by MAL Rewrite\\]\\s*$'
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Titles can be restored from original_title. Cleared backdrops and synopsis
  // credits are not restored; a content refresh brings back the provider's data.
  await sql`
    UPDATE content
    SET title = original_title, updated_at = now()
    WHERE data_source = 'jikan' AND original_title IS NOT NULL
  `.execute(db);

  await db.schema.alterTable('content').dropColumn('original_title').execute();
}
