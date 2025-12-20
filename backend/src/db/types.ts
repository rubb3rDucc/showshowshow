export interface Database {
  users: {
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  };
  content: {
    id: string;
    tmdb_id: number | null;
    mal_id: number | null;
    anilist_id: number | null;
    data_source: 'tmdb' | 'jikan' | 'anilist' | 'kitsu';
    content_type: 'show' | 'movie';
    title: string;
    title_english: string | null;
    title_japanese: string | null;
    poster_url: string | null;
    backdrop_url: string | null;
    overview: string | null;
    release_date: Date | null;
    first_air_date: Date | null;
    last_air_date: Date | null;
    default_duration: number;
    number_of_seasons: number | null;
    number_of_episodes: number | null;
    status: string | null;
    rating: string | null;
    created_at: Date;
    updated_at: Date;
  };
  episodes: {
    id: string;
    content_id: string;
    season: number;
    episode_number: number;
    title: string | null;
    overview: string | null;
    duration: number;
    air_date: Date | null;
    still_url: string | null;
    created_at: Date;
  };
  watch_history: {
    id: string;
    user_id: string;
    content_id: string;
    season: number | null;
    episode: number | null;
    watched_at: Date;
    rewatch_count: number;
    synced: boolean;
    created_at: Date;
  };
  schedule: {
    id: string;
    user_id: string;
    content_id: string;
    season: number | null;
    episode: number | null;
    scheduled_time: Date;
    duration: number;
    source_type: 'manual' | 'auto' | 'block' | 'rotation';
    source_id: string | null;
    watched: boolean;
    synced: boolean;
    timezone_offset: string | null; // Timezone offset in format like "-05:00" (EST) or "+00:00" (UTC)
    created_at: Date;
  };
  queue: {
    id: string;
    user_id: string;
    content_id: string;
    season: number | null;
    episode: number | null;
    position: number;
    synced: boolean;
    created_at: Date;
  };
  programming_blocks: {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    block_type: 'template' | 'custom';
    criteria: Record<string, any>;
    schedule_days: string[];
    start_time: string | null;
    end_time: string | null;
    rotation_type: 'sequential' | 'random';
    created_at: Date;
    updated_at: Date;
  };
  block_content: {
    id: string;
    block_id: string;
    content_id: string;
    position: number;
    time_slot: string | null;
    duration: number | null;
    current_season: number;
    current_episode: number;
    created_at: Date;
  };
  rotation_groups: {
    id: string;
    user_id: string;
    name: string | null;
    rotation_type: 'round_robin' | 'random';
    max_consecutive: number;
    created_at: Date;
  };
  rotation_content: {
    id: string;
    rotation_id: string;
    content_id: string;
    position: number;
    current_season: number;
    current_episode: number;
    created_at: Date;
  };
  user_preferences: {
    id: string;
    user_id: string;
    include_reruns: boolean;
    rerun_frequency: 'never' | 'rarely' | 'sometimes' | 'often';
    max_shows_per_time_slot: number;
    time_slot_duration: number;
    allow_overlap: boolean;
    default_start_time: string | null;
    default_end_time: string | null;
    onboarding_completed: boolean;
    created_at: Date;
    updated_at: Date;
  };
  sync_metadata: {
    id: string;
    user_id: string;
    last_sync_time: Date | null;
    sync_token: string | null;
    device_id: string | null;
    created_at: Date;
    updated_at: Date;
  };
  user_library: {
    id: string;
    user_id: string;
    content_id: string;
    status: 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
    current_season: number;
    current_episode: number;
    score: number | null;
    notes: string | null;
    started_at: Date | null;
    completed_at: Date | null;
    last_watched_at: Date | null;
    episodes_watched: number;
    created_at: Date;
    updated_at: Date;
  };
  library_episode_status: {
    id: string;
    user_id: string;
    content_id: string;
    season: number;
    episode: number;
    status: 'watched' | 'unwatched' | 'skipped';
    watched_at: Date | null;
    created_at: Date;
  };
}
