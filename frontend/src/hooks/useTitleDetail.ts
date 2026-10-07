import { useQuery } from '@tanstack/react-query';
import { getContentByTmdbId, getAnimeTitleDetail, getAnimeSeasons, getAnimeRelated } from '../api/content';
import { getContentCredits } from '../api/people';
import type { TitleDetail, TitleSource } from '../types/titleDetail';

// Detail data is cached server-side for days; no need to refetch on every visit
const ANIME_STALE_TIME = 60 * 60 * 1000;

/**
 * Loads a title for the detail page in the provider-neutral shape, whichever id
 * the page was opened with. Credits (TMDB), seasons and "More like this" (anime)
 * load separately so the page can render before they arrive.
 */
export function useTitleDetail(source: TitleSource) {
  const tmdb = source.kind === 'tmdb' ? source : null;
  const malId = source.kind === 'anime' && Number.isFinite(source.malId) ? source.malId : null;

  const contentQuery = useQuery({
    queryKey: ['content', tmdb?.type, tmdb?.tmdbId],
    queryFn: () => getContentByTmdbId(tmdb!.tmdbId, tmdb!.type),
    enabled: !!tmdb && Number.isFinite(tmdb.tmdbId),
  });

  const creditsQuery = useQuery({
    queryKey: ['content-credits', tmdb?.tmdbId, tmdb?.type === 'tv' ? 'show' : 'movie'],
    queryFn: () => getContentCredits(tmdb!.tmdbId, tmdb!.type === 'tv' ? 'show' : 'movie'),
    enabled: !!tmdb && Number.isFinite(tmdb.tmdbId),
  });

  const animeQuery = useQuery({
    queryKey: ['anime-detail', malId],
    queryFn: () => getAnimeTitleDetail(malId!),
    enabled: malId != null,
    staleTime: ANIME_STALE_TIME,
  });

  const seasonsQuery = useQuery({
    queryKey: ['anime-seasons', malId],
    queryFn: () => getAnimeSeasons(malId!),
    enabled: malId != null,
    staleTime: ANIME_STALE_TIME,
  });

  const relatedQuery = useQuery({
    queryKey: ['anime-related', malId],
    queryFn: () => getAnimeRelated(malId!),
    enabled: malId != null,
    staleTime: ANIME_STALE_TIME,
  });

  if (!tmdb) {
    const anime = animeQuery.data;
    return {
      detail: anime && {
        ...anime,
        seasons: seasonsQuery.data ?? [],
        recommendations: relatedQuery.data,
      },
      isLoading: animeQuery.isLoading,
      error: animeQuery.error,
      creditsLoading: false,
    };
  }

  const content = contentQuery.data;
  const credits = creditsQuery.data;
  const detail: TitleDetail | undefined = content && {
    content,
    original_title: null,
    genres: [],
    studios: [],
    cast: (credits?.cast ?? []).map((c) => ({ person_id: c.id, name: c.name, role: c.character || null })),
    crew: (credits?.crew ?? []).map((c) => ({
      person_id: c.id,
      name: c.name,
      role: c.job,
      department: c.department,
    })),
    relations: [],
    streaming: [],
    seasons: [], // TMDB seasons live inside one title; the episode tabs handle them
  };

  return {
    detail,
    isLoading: contentQuery.isLoading,
    error: contentQuery.error,
    creditsLoading: creditsQuery.isLoading,
  };
}
