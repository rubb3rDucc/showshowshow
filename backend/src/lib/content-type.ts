/**
 * Content type vocabularies.
 *
 * The database stores TV/movie as `content_type` = 'show' | 'movie', while TMDB
 * (and our API query params) use 'tv' | 'movie'. These two dialects must never be
 * compared as bare strings — a stray literal like 'series' silently never matches
 * and previously caused a destructive "wrong type cached → delete" path to fire on
 * every show. Centralize the mapping so the compiler rejects any invalid literal.
 */

export type DbContentType = 'show' | 'movie';
export type ApiContentType = 'tv' | 'movie';

/** DB content_type -> TMDB/API type. */
export function dbTypeToApiType(type: DbContentType): ApiContentType {
  return type === 'show' ? 'tv' : 'movie';
}

/** TMDB/API type -> DB content_type. */
export function apiTypeToDbType(type: ApiContentType): DbContentType {
  return type === 'tv' ? 'show' : 'movie';
}
