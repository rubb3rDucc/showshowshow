import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { SearchResult } from '../../types/api';
import { getRelatedTitles } from '../../api/content';
import { contentHref } from '../../utils/contentHref';
import { DiscoverRow } from './DiscoverRow';

interface RelatedTitlesProps {
  /** TMDB title to fetch recommendations for; ignored when `items` is given */
  type?: 'tv' | 'movie';
  tmdbId?: number;
  /** Recommendations that arrived with the title (anime) */
  items?: SearchResult[];
  className?: string;
}

/**
 * "More like this" shelf at the foot of a title's detail page, modelled on
 * Seerr. Renders nothing while loading, on error, or when there are no matches,
 * so the page never shows an empty or broken row.
 */
export function RelatedTitles({ type, tmdbId, items: givenItems, className }: RelatedTitlesProps) {
  const [, setLocation] = useLocation();

  const { data: fetchedItems } = useQuery({
    queryKey: ['related-titles', type, tmdbId],
    queryFn: () => getRelatedTitles(type!, tmdbId!),
    enabled: !givenItems && !!type && tmdbId != null && Number.isFinite(tmdbId),
    staleTime: 60 * 60 * 1000, // TMDB recommendations barely move; avoid refetching per visit
  });

  const items = givenItems ?? fetchedItems;
  if (!items?.length) return null;

  const open = (item: SearchResult) => {
    const href = contentHref(item);
    if (!href) return;
    setLocation(href);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={className}>
      <DiscoverRow title="More like this" items={items} onItemClick={open} />
    </div>
  );
}
