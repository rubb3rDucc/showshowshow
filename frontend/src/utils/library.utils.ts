import type { LibraryItem, LibraryItemUI, LibraryStatsAPI, LibraryStats, LibraryStatus } from '../types/library.types';

/**
 * Short, quiet status label for a library item.
 */
export function statusLabel(status: LibraryStatus): string {
  switch (status) {
    case 'watching':
      return 'Watching';
    case 'completed':
      return 'Finished';
    case 'dropped':
      return 'Dropped';
    case 'plan_to_watch':
      return 'Plan to watch';
  }
}

/**
 * One-line caption shown under a poster in the album grid / list views.
 * Examples: "Watching · 62%", "★ 9 · Finished", "Plan to watch", "Dropped".
 */
export function captionFor(item: LibraryItemUI): string {
  const score = item.score ? `★ ${item.score}` : null;
  switch (item.status) {
    case 'watching': {
      const pct =
        item.content.contentType === 'show' && item.progress
          ? `${item.progress.percentage}%`
          : null;
      return pct ? `Watching · ${pct}` : 'Watching';
    }
    case 'plan_to_watch':
      return 'Plan to watch';
    case 'completed':
      return score ? `${score} · Finished` : 'Finished';
    case 'dropped':
      return score ? `${score} · Dropped` : 'Dropped';
  }
}

/**
 * Convert API LibraryItem to UI-friendly format
 */
export function libraryItemToUI(item: LibraryItem): LibraryItemUI {
  return {
    id: item.id,
    contentId: item.content_id,
    status: item.status,
    currentSeason: item.current_season,
    currentEpisode: item.current_episode,
    score: item.score,
    notes: item.notes,
    addedAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
    lastWatchedAt: item.last_watched_at ? new Date(item.last_watched_at) : null,
    content: {
      tmdbId: item.content.tmdb_id,
      title: item.content.title,
      posterUrl: item.content.poster_url,
      contentType: item.content.content_type,
      numberOfEpisodes: item.content.number_of_episodes,
      numberOfSeasons: item.content.number_of_seasons,
    },
    progress: item.progress ? {
      episodesWatched: item.progress.episodes_watched,
      totalEpisodes: item.progress.total_episodes,
      percentage: item.progress.percentage,
    } : undefined,
    lastWatchedDisplay: formatLastWatched(item.last_watched_at),
  };
}

/**
 * Format last watched timestamp to human-readable string
 */
export function formatLastWatched(lastWatchedAt: string | null): string {
  if (!lastWatchedAt) {
    return 'Never watched';
  }

  try {
    const date = new Date(lastWatchedAt);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  } catch {
    return 'Never watched';
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(episodesWatched: number, totalEpisodes: number | null): number {
  if (!totalEpisodes || totalEpisodes === 0) {
    return 0;
  }
  return Math.round((episodesWatched / totalEpisodes) * 100);
}

/**
 * Convert API LibraryStats to UI format
 */
export function libraryStatsToUI(stats: LibraryStatsAPI): LibraryStats {
  return {
    totalItems: stats.total,
    watching: stats.watching,
    completed: stats.completed,
    dropped: stats.dropped,
    planToWatch: stats.plan_to_watch,
    totalShows: stats.shows,
    totalMovies: stats.movies,
    totalEpisodesWatched: stats.total_episodes_watched,
  };
}

