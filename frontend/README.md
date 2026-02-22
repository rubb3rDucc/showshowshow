# ShowShowShow Frontend

React + TypeScript frontend for ShowShowShow — a personalized TV/anime scheduling app.

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
- **Icons:** Lucide React
- **Notifications:** Sonner
- **Analytics:** PostHog

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

Frontend will be available at `http://localhost:5173`.

## Project Structure

```
src/
├── api/              # API client and domain modules
│   ├── client.ts    # Base fetch client (injects Clerk token)
│   ├── content.ts   # Content search & caching
│   ├── library.ts   # Library CRUD
│   ├── schedule.ts  # Schedule fetching & generation
│   ├── queue.ts     # Queue/lineup management
│   ├── billing.ts   # Stripe billing
│   └── ...
├── components/
│   ├── auth/        # ProtectedRoute wrapper
│   ├── billing/     # UpgradeModal (shown on 403)
│   ├── browse/      # Network/genre browsing
│   ├── home/        # Dashboard components (TonightSection, etc.)
│   ├── layout/      # Navigation, header
│   ├── library/     # Library cards, detail modals, episode tracking
│   ├── queue/       # Queue builder with calendar timeline
│   ├── schedule/    # Schedule calendar and cards
│   ├── search/      # Search interface and content cards
│   ├── settings/    # User settings
│   ├── stats/       # Activity & statistics
│   └── common/      # Shared utilities
├── pages/           # Top-level page components
├── hooks/           # Custom React hooks
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## Available Scripts

- `pnpm run dev` — Start Vite dev server
- `pnpm run build` — Build for production
- `pnpm run preview` — Preview production build
- `pnpm run lint` — Run ESLint

## Authentication

Authentication is handled entirely by Clerk. There is no custom auth store.

- `useAuth()` — Access auth state and retrieve tokens
- `useUser()` — Access the current user's profile
- All authenticated API requests include `Authorization: Bearer <clerk-token>`, injected automatically by `api/client.ts`
- `ProtectedRoute` redirects unauthenticated users to `/login`

## Subscription & Billing

The app uses a 3-tier entitlement model:

| Tier | Description |
| ---- | ----------- |
| `preview` | 7-day free trial (default for new users) |
| `pro` | Active paid subscription |
| `free` | Trial expired or subscription canceled |

When the backend returns a `403`, the `UpgradeModal` is shown automatically via a global event listener.

## Key Patterns

- **Data fetching**: TanStack Query with a 30s stale time; mutations invalidate related queries on success
- **403 handling**: Any `403` from the API dispatches a `show-upgrade-modal` custom event
- **Drag & drop**: Queue reordering uses `@dnd-kit`
- **Form validation**: Mantine forms handle validation and submission state
- **Analytics**: PostHog captures events and identifies users after login
