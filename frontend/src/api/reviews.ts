export interface Review {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
}

let store: Review[] = [
  // March 2026 — multiple entries in same month
  {
    id: '1',
    title: 'Breaking Bad vs The Wire',
    body: '<p>I keep thinking about how these two shows approach the same theme from completely different angles. Breaking Bad is a descent — one bad choice cascading into the next. The Wire is structural, almost sociological. Neither protagonist is the point; the system is.</p>',
    created_at: '2026-03-08T10:00:00Z',
    updated_at: '2026-03-08T10:00:00Z',
  },
  {
    id: '2',
    title: null, // no title — should show "Untitled"
    body: '<p>Started thinking about what makes a finale feel earned. Most shows collapse under the weight of their own mythology by the end. The ones that stick the landing usually do it by returning to something small.</p>',
    created_at: '2026-03-03T10:00:00Z',
    updated_at: '2026-03-03T10:00:00Z',
  },
  {
    id: '3',
    title: 'Rewatching Deadwood',
    body: null, // no body — should show no preview
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },

  // February 2026
  {
    id: '4',
    title: 'February notes',
    body: '<p>Three rewatches in and I still catch new things. The blocking in episode 4 alone is worth studying — every character positioned relative to who has power in that scene.</p>',
    created_at: '2026-02-21T10:00:00Z',
    updated_at: '2026-02-21T10:00:00Z',
  },
  {
    id: '5',
    title: null,
    body: '<p>The pacing on this one is brutal in the best way. Nothing happens for 40 minutes and then everything happens at once.</p>',
    created_at: '2026-02-07T10:00:00Z',
    updated_at: '2026-02-07T10:00:00Z',
  },

  // December 2025 — previous year
  {
    id: '6',
    title: 'End of year wrap',
    body: '<p>Looking back at everything watched this year. Standouts: Severance S2, The Bear S3, and a random Korean thriller I stumbled on in October that I keep recommending to everyone.</p>',
    created_at: '2025-12-28T10:00:00Z',
    updated_at: '2025-12-28T10:00:00Z',
  },

  // October 2025
  {
    id: '7',
    title: 'On slow TV',
    body: '<p>Been watching a lot of "slow TV" lately — the Norwegian train journeys, fireplace streams, that kind of thing. There is something genuinely meditative about content with no arc.</p>',
    created_at: '2025-10-14T10:00:00Z',
    updated_at: '2025-10-14T10:00:00Z',
  },

  // March 2024 — two years back
  {
    id: '8',
    title: null,
    body: '<p>First entry ever. Not sure what I am doing here but I want somewhere to put these thoughts down.</p>',
    created_at: '2024-03-02T10:00:00Z',
    updated_at: '2024-03-02T10:00:00Z',
  },
];

export async function getReviews(): Promise<Review[]> {
  return [...store].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getReview(id: string): Promise<Review> {
  const review = store.find((r) => r.id === id);
  if (!review) throw new Error(`Review ${id} not found`);
  return { ...review };
}

export async function createReview(): Promise<Review> {
  const now = new Date().toISOString();
  const review: Review = {
    id: crypto.randomUUID(),
    title: null,
    body: null,
    created_at: now,
    updated_at: now,
  };
  store = [review, ...store];
  return { ...review };
}

export async function updateReview(
  id: string,
  data: { title?: string; body?: string }
): Promise<Review> {
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Review ${id} not found`);
  store[idx] = { ...store[idx], ...data, updated_at: new Date().toISOString() };
  return { ...store[idx] };
}

export async function deleteReview(id: string): Promise<void> {
  store = store.filter((r) => r.id !== id);
}
