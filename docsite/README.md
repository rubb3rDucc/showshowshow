# ShowShowShow Docs

Documentation site built with [Docusaurus](https://docusaurus.io/).

## Status

Not deployed. `docusaurus.config.ts` still points `url` at `http://localhost:3001`.

The content in `docs/` is currently a mirror of private working notes, including
audits and strategy documents, so **it is not publishable as-is**. Making this
public-facing means authoring a separate, smaller doc set.

There is also a build blocker: the repo root `.gitignore` ignores `docs` with an
unanchored rule, which matches `docsite/docs` as well as the root `docs/`. That
means the site's content is untracked and CI cannot build it. Anchoring the rule
to `/docs/` is a prerequisite.

## Development

```bash
cd docsite
pnpm install
pnpm start      # http://localhost:3001
pnpm build      # static build into build/
pnpm serve      # serve the build
pnpm typecheck
```
