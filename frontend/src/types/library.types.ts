// Library types matching the feature doc

export type LibraryStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
export type LibraryFilterStatus = 'all' | LibraryStatus;
export type LibraryFilterType = 'all' | 'show' | 'movie';
export type LibrarySortOption = 
  | 'recently_added' 
  | 'alphabetical' 
  | 'recently_updated' 
  | 'last_watched' 
  | 'score' 
  | 'progress';

export type EpisodeStatus = 'watched' | 'unwatched' | 'skipped';

export type LibraryCardColor = 
  | 'yellow' 
  | 'pink' 
  | 'cyan' 
  | 'purple' 
  | 'blue' 
  | 'orange' 
  | 'green' 
  | 'rose' 
  | 'indigo' 
  | 'teal';

export interface LibraryItem {
  id: string;
  user_id: string;
  content_id: string;
  status: LibraryStatus;
  current_season: number;
  current_episode: number;
  score: number | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_watched_at: string | null;
  episodes_watched: number;
  created_at: string;
  updated_at: string;
  // Joined data from backend
  content: {
    id: string;
    title: string;
    poster_url: string | null;
    content_type: 'show' | 'movie';
    number_of_episodes: number | null;
    number_of_seasons: number | null;
  };
  // Computed
  progress: {
    episodes_watched: number;
    total_episodes: number;
    percentage: number; // 0-100
  };
  last_watched_display?: string; // Human-readable: "2 days ago", "Never watched"
}

// API response format (from backend)
export interface LibraryStatsAPI {
  total: number;
  watching: number;
  completed: number;
  dropped: number;
  plan_to_watch: number;
  shows: number;
  movies: number;
  total_episodes_watched: number;
}

// UI format (for components)
export interface LibraryStats {
  totalItems: number;
  watching: number;
  completed: number;
  dropped: number;
  planToWatch: number;
  totalShows: number;
  totalMovies: number;
  totalEpisodesWatched: number;
}

export interface EpisodeStatusItem {
  season: number;
  episode: number;
  status: EpisodeStatus;
  watched_at?: string;
}

export interface CreateLibraryItemRequest {
  content_id: string;
  status?: LibraryStatus;
}

export interface UpdateLibraryItemRequest {
  status?: LibraryStatus;
  current_season?: number;
  current_episode?: number;
  score?: number | null;
  notes?: string | null;
}

export interface MarkEpisodeRequest {
  season: number;
  episode: number;
  status: EpisodeStatus;
}

export interface MarkSeasonRequest {
  season: number;
  status: 'watched' | 'unwatched';
}

export interface MarkAllEpisodesRequest {
  status: 'watched' | 'unwatched';
}

// Frontend-friendly version (converted from API response)
export interface LibraryItemUI {
  id: string;
  contentId: string;
  status: LibraryStatus;
  currentSeason: number;
  currentEpisode: number;
  score: number | null;
  notes: string | null;
  cardColor?: LibraryCardColor;
  addedAt: Date;
  updatedAt: Date;
  lastWatchedAt: Date | null;
  content: {
    title: string;
    posterUrl: string | null;
    contentType: 'show' | 'movie';
    numberOfEpisodes: number | null;
    numberOfSeasons: number | null;
    description?: string | null;
  };
  progress?: {
    episodesWatched: number;
    totalEpisodes: number;
    percentage: number;
  };
  lastWatchedDisplay?: string;
}

