// API types
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ApiError {
  statusCode: number;
  code: string;
  error: string;
  message: string;
}

// Content types
export interface Content {
  id: string;
  tmdb_id: number;
  content_type: 'show' | 'movie';
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  release_date: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  default_duration: number;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  tmdb_id: number;
  title: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  content_type: 'tv' | 'movie';
  media_type: 'tv' | 'movie';
  release_date: string | null;
  vote_average: number;
  popularity: number;
  is_cached: boolean;
  cached_id: string | null;
  cached_type: 'show' | 'movie' | null;
}

export interface SearchResponse {
  results: SearchResult[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface QueueItem {
  id: string;
  user_id?: string;
  content_id: string;
  position: number;
  season?: number | null;
  episode?: number | null;
  created_at: string;
  // Joined data from backend
  tmdb_id?: number;
  title?: string;
  poster_url?: string | null;
  content_type?: 'show' | 'movie';
  content?: Content;
}

export interface Episode {
  id: string;
  content_id: string;
  season: number;
  episode_number: number;
  title: string;
  overview: string | null;
  duration: number;
  air_date: string | null;
  still_url: string | null;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  user_id?: string;
  content_id: string;
  season: number | null;
  episode: number | null;
  scheduled_time: string;
  duration: number;
  source_type?: string;
  source_id?: string | null;
  watched: boolean;
  created_at?: string;
  // Joined data from backend
  tmdb_id?: number;
  title: string;
  poster_url: string | null;
  content_type: 'show' | 'movie';
}

export interface GenerateScheduleRequest {
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  time_slot_duration?: number; // in minutes (default: 30)
  rotation_type?: 'round_robin' | 'random';
  include_reruns?: boolean;
}

