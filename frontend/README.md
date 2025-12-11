# ShowShowShow Frontend

React + TypeScript frontend for ShowShowShow TV schedule manager.

## Tech Stack

- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter
- **State Management:** Zustand + TanStack Query
- **Styling:** Tailwind CSS (default components for now)
- **Icons:** Lucide React
- **Notifications:** Sonner

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file:

```bash
VITE_API_URL=http://localhost:3000
```

### 3. Start Development Server

```bash
pnpm run dev
```

Frontend will be available at `http://localhost:5173`

## Project Structure

```
src/
├── api/              # API client and endpoints
├── components/       # React components
│   ├── auth/        # Auth-related components
│   ├── layout/      # Layout components
│   └── common/      # Shared components
├── pages/           # Page components
├── stores/          # Zustand stores
├── types/           # TypeScript types
├── hooks/           # Custom React hooks
└── utils/           # Utility functions
```

## Current Status

### ✅ Implemented (Phase 1 - Structure)

**Authentication:**
- Login page
- Register page
- Auth state management (Zustand)
- Token persistence (localStorage)
- Protected routes

**Navigation:**
- Main layout with navigation
- Route protection
- Active route highlighting

**Pages (Placeholders):**
- Home/Dashboard - Shows welcome message and schedule placeholder
- Search - Placeholder for content search
- Queue - Placeholder for queue management

### 🚧 Next Steps (Phase 2)

1. Search functionality
2. Content cards
3. Queue management
4. Schedule generation
5. Retro styling

## Available Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Run ESLint

## Testing the Auth Flow

1. Start the backend server (see `backend/README.md`)
2. Start the frontend: `pnpm run dev`
3. Visit `http://localhost:5173`
4. You'll be redirected to `/login`
5. Click "Register" to create an account
6. After registration, you'll be logged in and see the Home page
7. Navigate between Home, Search, and Queue
8. Click Logout to return to login

## API Integration

The frontend connects to the backend API at `http://localhost:3000` by default.

**Current Endpoints Used:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

**Future Endpoints:**
- `GET /api/content/search` - Search content
- `GET /api/queue` - Get user's queue
- `POST /api/queue` - Add to queue
- `POST /api/schedule/generate/queue` - Generate schedule

## Styling

Currently using default Tailwind components. Retro styling (early 2000s aesthetic) will be added in a later phase.

**Planned Aesthetic:**
- Dark blue/teal gradients
- Card-based layout
- Weekly calendar view
- "Progressive Viewing Technology" vibe

## Notes

- Auth tokens are stored in localStorage
- Token persists across page refreshes
- Logout clears the token
- Protected routes redirect to `/login` if not authenticated
