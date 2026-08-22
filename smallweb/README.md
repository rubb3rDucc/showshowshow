# ShowShowShow Marketing Site

The public marketing site at [showshowshow.app](https://showshowshow.app), built with Astro and Tailwind CSS. The app itself lives at `app.showshowshow.app` and is served from `frontend/`.

## Pages

| Route | Purpose |
|---|---|
| `/` | Homepage. Copy and layout are inlined directly in `index.astro` plus `styles/home.css`. |
| `/privacy` | Self-hosted privacy policy |
| `/terms` | Self-hosted terms, covering subscriptions, refunds, and auto-renewal |
| `/contact` | Contact details |
| `/404` | Not found |

The legal pages are self-hosted rather than embedded from a third party. They are a
starting template and have not been reviewed by a lawyer.

## Setup

```bash
cd smallweb
pnpm install
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PUBLIC_APP_URL` | no | Main app URL for the Login, Start Trial, and Go to app links. Defaults to `https://app.showshowshow.app`. |
| `PUBLIC_UMAMI_URL`, `PUBLIC_UMAMI_ID` | no | Umami analytics, wired up in `layouts/Layout.astro`. The app itself uses PostHog; these are separate. |

The site is fully static and makes **no API calls**, so it needs no backend URL.

## Development

```bash
pnpm dev      # http://localhost:4321
pnpm build    # outputs to dist/
pnpm preview  # serve the build
```

## Project Structure

```text
smallweb/
├── src/
│   ├── components/     # Astro components
│   ├── layouts/        # Layout.astro, wraps every page
│   ├── pages/          # index, privacy, terms, contact, 404
│   └── styles/         # global.css, home.css
├── public/
│   ├── images/         # Screenshots
│   └── videos/
└── dist/               # Build output, gitignored
```

## A note on components

`src/components/` still holds section components from an earlier multi-section
homepage (`Hero`, `Features`, `Pricing`, `FAQ`, `Comparison`, `UseCases`, and
others). The homepage was rewritten to inline its markup, so **only `Header.astro`
is still imported**, by `404.astro`. The rest are unreferenced and are candidates
for deletion. They remain in git history either way.

## Deployment

Deployed as a static build. `dist/` is the output directory and Astro is detected
automatically by every major static host. Set any `PUBLIC_*` values in the host's
environment settings before the build runs, since Astro inlines them at build
time rather than reading them per request.
