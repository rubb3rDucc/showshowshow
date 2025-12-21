# ShowShowShow Landing Page

Marketing landing page for ShowShowShow built with Astro and Tailwind CSS.

## Setup

1. Install dependencies:
```bash
cd smallweb
pnpm install
# or
npm install
```

2. Copy the example environment file and fill in your values:
```bash
cp .env.example .env
```

Then edit `.env` with your actual values. See `.env.example` for all available options.

**Required for waitlist:**
- `PUBLIC_API_URL` - Your backend API URL (e.g., `https://api.showshowshow.com`)

**Optional:**
- `PUBLIC_APP_URL` - Main app URL for links
- `PUBLIC_UMAMI_URL` & `PUBLIC_UMAMI_ID` - Analytics (optional)

## Development

```bash
pnpm dev
# or
npm run dev
```

Visit `http://localhost:4321`

## Build

```bash
pnpm build
# or
npm run build
```

Output will be in `dist/`

## Preview

```bash
pnpm preview
# or
npm run preview
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed deployment instructions.

**Quick start (Vercel - Recommended):**

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set root directory to `smallweb`
4. Add environment variables:
   - `PUBLIC_API_URL` (required)
   - `PUBLIC_APP_URL` (optional)
   - `PUBLIC_UMAMI_URL` & `PUBLIC_UMAMI_ID` (optional)
5. Deploy!

Vercel auto-detects Astro and requires zero configuration. See `DEPLOYMENT.md` for Netlify, Cloudflare Pages, and other options.

## Project Structure

```
smallweb/
├── src/
│   ├── components/     # Astro components
│   ├── layouts/        # Layout components
│   ├── pages/          # Pages (index.astro)
│   └── styles/         # Global styles
├── public/             # Static assets
└── dist/              # Build output
```

## Features

- Single-page marketing site
- Brutalist design aesthetic
- Responsive design
- SEO optimized
- Umami analytics integration
- Image rotation system
- Waitlist signup
- Legal pages (Privacy, Terms, Contact)

## Images

Screenshot images should be placed in `/public/images/`:

- **Features section**: `schedule1.png`, `schedule2.png`, `schedule3.png`
- **HowItWorks section**: `scheduling-interface.png`, `scheduling-interface-2.png`, etc.
- **Pricing section**: `billing-dashboard.png`, `billing-dashboard-2.png`, etc.
- **UseCases section**: `user-profile.png`, `user-profile-2.png`, etc.
- **Comparison section**: `comparison-view.png`, `comparison-view-2.png`, etc.

Images will automatically rotate every 4 seconds. Update the image arrays in each component's frontmatter.

## Missing Assets

Before deployment, add:
- `/public/favicon.ico` (or `.svg`)
- `/public/og-image.png` (1200x630px for social sharing)

## TODO

See `COMPLETION_CHECKLIST.md` for full list of remaining tasks.
