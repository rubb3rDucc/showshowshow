import { Kysely, sql } from 'kysely';

/**
 * Cleans up duplicate anime episodes left by the old episodes route.
 *
 * The bug: GET /api/content/:tmdbId/episodes re-fetched an anime's episode list
 * on every load and numbered each episode `allEpisodes.length + 1`, where
 * allEpisodes already held the stored rows. So every load appended a full copy
 * of the list after the last one (26 episodes -> 52 -> 78...). In prod on
 * 2026-10-06 this had reached e.g. 286 rows for a 26-episode show. Fixed by
 * syncAnimeEpisodes (lib/anime-episodes.ts), which numbers from the provider's
 * episode id and skips what's stored.
 *
 * Recovery: each copy starts from episode 1 again, so a copy begins wherever
 * episode 1's title reappears, and a row's true number is its position within
 * its copy. That holds even when a show kept airing between loads (later copies
 * are longer), where matching titles alone would not.
 *
 * For each affected anime (season-1 rows outnumber its episode count):
 *  1. episodes: keep one row per true number (from the newest copy), renumber
 *  2. library_episode_status: move marks to the true number; where several land
 *     on one episode, keep watched > skipped > unwatched, latest first
 *  3. watch_history: move to the true number, keeping the latest play
 *  4. schedule, queue: renumber
 *  5. user_library: renumber current_episode, recount episodes_watched
 *
 * Shows where the copies disagree on many titles are skipped and logged, since
 * the positions may not line up; they need a manual look.
 *
 * Not reversible: the duplicate rows carried no information of their own.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Old number -> true number for every season-1 row of an affected anime
  await sql`
    CREATE TEMP TABLE ep_map ON COMMIT DROP AS
    WITH affected AS (
      SELECT c.id AS content_id
      FROM content c
      JOIN episodes e ON e.content_id = c.id AND e.season = 1
      WHERE c.data_source = 'jikan'
      GROUP BY c.id
      HAVING count(*) > coalesce(c.number_of_episodes, count(DISTINCT e.title))
    ),
    ep1 AS (
      SELECT e.content_id, e.title
      FROM episodes e JOIN affected USING (content_id)
      WHERE e.season = 1 AND e.episode_number = 1
    ),
    starts AS (
      SELECT e.content_id, e.episode_number AS start
      FROM episodes e JOIN ep1 USING (content_id)
      WHERE e.season = 1 AND e.title IS NOT DISTINCT FROM ep1.title
    )
    SELECT e.id, e.content_id, e.episode_number AS old_number, e.title,
           e.episode_number - (
             SELECT max(s.start) FROM starts s WHERE s.content_id = e.content_id AND s.start <= e.episode_number
           ) + 1 AS true_number
    FROM episodes e JOIN affected USING (content_id)
    WHERE e.season = 1
  `.execute(db);

  // Nothing to collapse (a single copy), or no episode 1 to anchor on
  await sql`
    DELETE FROM ep_map WHERE content_id IN (
      SELECT content_id FROM ep_map GROUP BY content_id
      HAVING bool_or(true_number IS NULL) OR bool_and(true_number = old_number)
    )
  `.execute(db);

  // Too many title disagreements between copies: positions may be off, so skip
  const skipped = await sql<{ title: string; conflicts: number; episodes: number }>`
    WITH per_number AS (
      SELECT content_id, true_number, count(DISTINCT title) AS titles FROM ep_map GROUP BY 1, 2
    ),
    bad AS (
      SELECT content_id, count(*) FILTER (WHERE titles > 1)::int AS conflicts, count(*)::int AS episodes
      FROM per_number GROUP BY content_id
      HAVING count(*) FILTER (WHERE titles > 1) > greatest(3, count(*) / 10)
    )
    SELECT c.title, b.conflicts, b.episodes FROM bad b JOIN content c ON c.id = b.content_id
  `.execute(db);
  await sql`
    DELETE FROM ep_map WHERE content_id IN (
      SELECT content_id FROM (
        SELECT content_id, true_number, count(DISTINCT title) AS titles FROM ep_map GROUP BY 1, 2
      ) p
      GROUP BY content_id
      HAVING count(*) FILTER (WHERE titles > 1) > greatest(3, count(*) / 10)
    )
  `.execute(db);

  const before = await sql<{ title: string; rows: number; episodes: number }>`
    SELECT c.title, count(*)::int AS rows, count(DISTINCT m.true_number)::int AS episodes
    FROM ep_map m JOIN content c ON c.id = m.content_id
    GROUP BY c.title ORDER BY c.title
  `.execute(db);

  // 1. Episodes: newest copy wins; renumber via negatives to dodge the unique key mid-update
  await sql`
    CREATE TEMP TABLE ep_keep ON COMMIT DROP AS
    SELECT DISTINCT ON (content_id, true_number) id, true_number
    FROM ep_map ORDER BY content_id, true_number, old_number DESC
  `.execute(db);
  await sql`DELETE FROM episodes WHERE id IN (SELECT id FROM ep_map EXCEPT SELECT id FROM ep_keep)`.execute(db);
  await sql`UPDATE episodes e SET episode_number = -k.true_number FROM ep_keep k WHERE e.id = k.id`.execute(db);
  await sql`UPDATE episodes SET episode_number = -episode_number WHERE id IN (SELECT id FROM ep_keep)`.execute(db);

  // 2. Watched marks
  await sql`
    CREATE TEMP TABLE les_map ON COMMIT DROP AS
    SELECT l.id, l.user_id, l.content_id, m.true_number, l.status, l.watched_at
    FROM library_episode_status l
    JOIN ep_map m ON m.content_id = l.content_id AND m.old_number = l.episode
    WHERE l.season = 1
  `.execute(db);
  await sql`
    CREATE TEMP TABLE les_keep ON COMMIT DROP AS
    SELECT DISTINCT ON (user_id, content_id, true_number) id, true_number
    FROM les_map
    ORDER BY user_id, content_id, true_number,
             CASE status WHEN 'watched' THEN 0 WHEN 'skipped' THEN 1 ELSE 2 END,
             watched_at DESC NULLS LAST
  `.execute(db);
  await sql`DELETE FROM library_episode_status WHERE id IN (SELECT id FROM les_map EXCEPT SELECT id FROM les_keep)`.execute(db);
  await sql`UPDATE library_episode_status l SET episode = -k.true_number FROM les_keep k WHERE l.id = k.id`.execute(db);
  await sql`UPDATE library_episode_status SET episode = -episode WHERE id IN (SELECT id FROM les_keep)`.execute(db);

  // 3. Watch history: latest play wins
  await sql`
    CREATE TEMP TABLE wh_map ON COMMIT DROP AS
    SELECT w.id, w.user_id, w.content_id, m.true_number, w.watched_at
    FROM watch_history w
    JOIN ep_map m ON m.content_id = w.content_id AND m.old_number = w.episode
    WHERE w.season = 1
  `.execute(db);
  await sql`
    CREATE TEMP TABLE wh_keep ON COMMIT DROP AS
    SELECT DISTINCT ON (user_id, content_id, true_number) id, true_number
    FROM wh_map ORDER BY user_id, content_id, true_number, watched_at DESC
  `.execute(db);
  await sql`DELETE FROM watch_history WHERE id IN (SELECT id FROM wh_map EXCEPT SELECT id FROM wh_keep)`.execute(db);
  await sql`UPDATE watch_history w SET episode = -k.true_number FROM wh_keep k WHERE w.id = k.id`.execute(db);
  await sql`UPDATE watch_history SET episode = -episode WHERE id IN (SELECT id FROM wh_keep)`.execute(db);

  // 4. Schedule and lineup (no unique keys on the number)
  await sql`
    UPDATE schedule s SET episode = m.true_number
    FROM (SELECT DISTINCT content_id, old_number, true_number FROM ep_map) m
    WHERE s.content_id = m.content_id AND s.season = 1 AND s.episode = m.old_number AND m.old_number <> m.true_number
  `.execute(db);
  await sql`
    UPDATE queue q SET episode = m.true_number
    FROM (SELECT DISTINCT content_id, old_number, true_number FROM ep_map) m
    WHERE q.content_id = m.content_id AND q.season = 1 AND q.episode = m.old_number AND m.old_number <> m.true_number
  `.execute(db);

  // 5. Library position and progress
  await sql`
    UPDATE user_library u SET current_episode = m.true_number
    FROM (SELECT DISTINCT content_id, old_number, true_number FROM ep_map) m
    WHERE u.content_id = m.content_id AND u.current_season = 1 AND u.current_episode = m.old_number
      AND m.old_number <> m.true_number
  `.execute(db);
  await sql`
    UPDATE user_library u SET episodes_watched = (
      SELECT count(*) FROM library_episode_status l
      WHERE l.user_id = u.user_id AND l.content_id = u.content_id AND l.status = 'watched'
    )
    WHERE u.content_id IN (SELECT DISTINCT content_id FROM ep_map)
  `.execute(db);

  // Shows up in the migration log (CI's "Run DB migrations" step)
  for (const r of before.rows) console.log(`  dedupe: ${r.title}: ${r.rows} rows -> ${r.episodes} episodes`);
  for (const r of skipped.rows) {
    console.log(`  dedupe SKIPPED (check by hand): ${r.title}: ${r.conflicts} of ${r.episodes} episodes disagree on title`);
  }
}

export async function down(): Promise<void> {
  // Not reversible, and nothing to undo: the removed rows were copies.
}
