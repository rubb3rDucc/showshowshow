import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { SearchResult } from '../../types/api';
import { getRelatedTitles } from '../../api/content';
import { DiscoverRow } from './DiscoverRow';

interface RelatedTitlesProps {
  type: 'tv' | 'movie';
  tmdbId: number;
  className?: string;
}

/**
 * "More like this" shelf at the foot of a title's detail page, modelled on
 * Seerr. Renders nothing while loading, on error, or when TMDB has no matches,
 * so the page never shows an empty or broken row.
 */
export function RelatedTitles({ type, tmdbId, className }: RelatedTitlesProps) {
  const [, setLocation] = useLocation();

  const { data: items } = useQuery({
    queryKey: ['related-titles', type, tmdbId],
    queryFn: () => getRelatedTitles(type, tmdbId),
    enabled: Number.isFinite(tmdbId),
    staleTime: 60 * 60 * 1000, // TMDB recommendations barely move; avoid refetching per visit
  });

  if (!items?.length) return null;

  const open = (item: SearchResult) => {
    setLocation(`/content/${item.content_type}/${item.tmdb_id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={className}>
      <DiscoverRow title="More like this" items={items} onItemClick={open} />
    </div>
  );
}
