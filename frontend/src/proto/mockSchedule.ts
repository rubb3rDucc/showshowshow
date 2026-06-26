// Mock data for the scheduling-workspace prototype (concierge / single-timeline model).
// Dev-only; not wired to real data. Fixed date so it renders deterministically.

export const BASE_DATE = '2025-06-28'; // a Saturday — "Saturday morning cartoons" vibe
export const BASE_DATE_LABEL = 'Saturday, June 28';

// ---- Schedule-X: tonight's single timeline (HH:mm on BASE_DATE) ----
export type SxLineupItem = { id: string; title: string; start: string; end: string; description?: string };
export const sxLineup: SxLineupItem[] = [
  { id: '1', title: 'Rugrats · S2E5', start: '18:00', end: '18:30', description: 'Cartoons' },
  { id: '2', title: 'Hey Arnold! · S1E2', start: '18:30', end: '19:00', description: 'Cartoons' },
  { id: '3', title: 'Doug · S3E1', start: '19:00', end: '19:30', description: 'Cartoons' },
  { id: '4', title: 'Recess · S4E3', start: '19:30', end: '20:00', description: 'Cartoons' },
  { id: '5', title: 'Samurai Jack · S1E1', start: '20:00', end: '20:30', description: 'Anime' },
  { id: '6', title: 'Cowboy Bebop · S1E5', start: '20:30', end: '21:00', description: 'Anime' },
  { id: '7', title: 'Blade', start: '21:00', end: '23:00', description: 'Movie' },
];

// ---- The "content drawer" / lineup pool ----
export type PoolItem = {
  id: string;
  title: string;
  type: 'show' | 'movie';
  color: string; // poster placeholder color
  meta: string; // e.g. "12 eps left" / "1h 48m"
  inOrder: boolean; // sequential vs shuffle (shows only)
  status: 'watching' | 'plan';
  runtime: number; // minutes — per-episode for shows, full length for movies
  seasons?: number; // shows only — drives the episode picker
  epsPerSeason?: number;
};

export const lineupPool: PoolItem[] = [
  { id: 'p1', title: 'Rugrats', type: 'show', color: '#7c3aed', meta: '38 eps left', inOrder: true, status: 'watching', runtime: 24, seasons: 9, epsPerSeason: 13 },
  { id: 'p2', title: 'Hey Arnold!', type: 'show', color: '#7c3aed', meta: '12 eps left', inOrder: true, status: 'watching', runtime: 24, seasons: 5, epsPerSeason: 10 },
  { id: 'p3', title: 'Doug', type: 'show', color: '#7c3aed', meta: '52 eps left', inOrder: true, status: 'plan', runtime: 24, seasons: 4, epsPerSeason: 13 },
  { id: 'p4', title: 'Recess', type: 'show', color: '#7c3aed', meta: '9 eps left', inOrder: false, status: 'watching', runtime: 22, seasons: 6, epsPerSeason: 10 },
  { id: 'p5', title: 'Samurai Jack', type: 'show', color: '#0ea5e9', meta: '4 eps left', inOrder: true, status: 'watching', runtime: 23, seasons: 5, epsPerSeason: 10 },
  { id: 'p6', title: 'Cowboy Bebop', type: 'show', color: '#0ea5e9', meta: '21 eps left', inOrder: true, status: 'plan', runtime: 24, seasons: 1, epsPerSeason: 26 },
  { id: 'p7', title: 'Wakfu', type: 'show', color: '#0ea5e9', meta: '13 eps left', inOrder: true, status: 'plan', runtime: 22, seasons: 3, epsPerSeason: 13 },
  { id: 'p8', title: 'Outlaw Star', type: 'show', color: '#0ea5e9', meta: '26 eps left', inOrder: true, status: 'plan', runtime: 24, seasons: 1, epsPerSeason: 26 },
  { id: 'p9', title: 'Blade', type: 'movie', color: '#e11d48', meta: '2h 0m', inOrder: false, status: 'plan', runtime: 120 },
  { id: 'p10', title: 'Akira', type: 'movie', color: '#e11d48', meta: '2h 4m', inOrder: false, status: 'plan', runtime: 124 },
];
