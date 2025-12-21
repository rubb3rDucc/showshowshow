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
- Dark theme matching app design
- Responsive design
- SEO optimized
- Umami analytics integration
- Succinct copywriting
- Privacy-focused messaging
