# ShowShowShow Frontend

React + TypeScript frontend for ShowShowShow, a personal TV and anime scheduling app.

## Tech Stack

- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter
- **Auth:** Clerk (`@clerk/clerk-react`)
- **Server State:** TanStack Query
- **UI Components:** Mantine (forms, dates, core)
- **Styling:** Tailwind CSS
- **Drag & Drop:** @dnd-kit
- **Calendar:** Schedule-X (the Lineup view, behind the `scheduleV2` flag)
- **Rich text:** Tiptap (the review editor)
- **Image export:** modern-screenshot (share cards)
- **Icons:** Lucide React
- **Notifications:** Sonner
- **Analytics:** PostHog

Node 22.x, pinned via `engines.node`.

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file in `/frontend`:

```bash
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

Both variables are required. Get your Clerk publishable key from the [Clerk dashboard](https://dashboard.clerk.com).

### 3. Start Development Server

```bash
pnpm run dev
```

Frontend will be available at `http://localhost:5173`, or `$FRONTEND_PORT` if set.

## Project Structure

```
src/
├── api/              # API client and domain modules
│   ├── client.ts    # Base fetch client (injects Clerk token)
│   ├── content.ts   # Content search & caching
│   ├── library.ts   # Library CRUD
│   ├── schedule.ts  # Schedule fetching & generation
│   ├── queue.ts     # Queue/lineup management
│   ├── lists.ts     # Lists and collections
│   ├── reviews.ts   # Review CRUD
│   ├── billing.ts   # Stripe billing
│   └── ...
├── components/
│   ├── auth/        # ProtectedRoute wrapper
│   ├── billing/     # UpgradeModal (shown on 403)
│   ├── browse/      # Network/genre browsing
│   ├── home/        # Dashboard components (TonightSection, etc.)
│   ├── layout/      # Navigation, header
│   ├── library/     # Library cards, detail modals, episode tracking
│   ├── queue/       # Lineup builder with calendar timeline
│   ├── schedule/    # Schedule calendar and cards
│   ├── search/      # Search interface and content cards
│   ├── settings/    # User settings
│   ├── stats/       # Activity and statistics
│   └── common/      # Shared utilities, BrandMark
├── pages/           # Top-level page components
├── hooks/           # Custom React hooks (useCollections, usePosterSize, ...)
├── proto/           # Prototypes not yet promoted to pages
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## Available Scripts

- `pnpm run dev` - Start Vite dev server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Run ESLint

## Authentication

Authentication is handled entirely by Clerk. There is no custom auth store.

- `useAuth()` - Access auth state and retrieve tokens
- `useUser()` - Access the current user's profile
- All authenticated API requests include `Authorization: Bearer <clerk-token>`, injected automatically by `api/client.ts`
- `ProtectedRoute` redirects unauthenticated users to `/login`

## Subscription & Billing

The app currently uses a 3-tier entitlement model. Note that this is a hard gate
today: `free` cannot write anything. Moving to metered free limits is tracked in
the backlog.

| Tier | Description |
| ---- | ----------- |
| `preview` | 7-day free trial (default for new users) |
| `pro` | Active paid subscription |
| `free` | Trial expired or subscription canceled |

When the backend returns a `403`, the `UpgradeModal` is shown automatically via a global event listener.

## Key Patterns

- **Page shell**: every page uses the shared `PageHeader` + `PageContainer` pair, so headers and spacing stay consistent. Do not hand-roll a page header.
- **Data fetching**: TanStack Query with a 30s stale time; mutations invalidate related queries on success
- **403 handling**: Any `403` from the API dispatches a `show-upgrade-modal` custom event
- **Drag & drop**: Lineup and ranked-list reordering both use `@dnd-kit`
- **Cross-source identity**: list items and library rows key off `content.id`, never `tmdb_id`, so anime and Western titles behave the same
- **Form validation**: Mantine forms handle validation and submission state
- **Analytics**: PostHog captures events and identifies users after login
