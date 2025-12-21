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

2. Create `.env` file:
```bash
# App URL
PUBLIC_APP_URL=https://app.showshowshow.com

# Umami Analytics (optional)
PUBLIC_UMAMI_URL=https://umami.example.com
PUBLIC_UMAMI_ID=your-website-id
```

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

### Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Netlify

1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy

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
