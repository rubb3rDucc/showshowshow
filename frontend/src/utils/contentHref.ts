/**
 * Detail page URL for a title, whichever id it has. TMDB wins when both exist;
 * MAL-only anime open the anime variant. Null when there's nothing to open.
 */
export function contentHref(item: {
  tmdb_id: number | null;
  mal_id: number | null;
  content_type: string;
}): string | null {
  if (item.tmdb_id) return `/content/${item.content_type === 'movie' ? 'movie' : 'tv'}/${item.tmdb_id}`;
  if (item.mal_id) return animeHref(item.mal_id);
  return null;
}

/** Detail page URL for an anime by MAL id */
export const animeHref = (malId: number) => `/content/anime/${malId}`;
