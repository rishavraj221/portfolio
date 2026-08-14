# web

The portfolio at rishavraj.info — Vite + React + TypeScript, statically generated so every
route still ships as real HTML with its own title/description/OG tags/JSON-LD, same as
before this was React.

Built with:
- **[vite-react-ssg](https://github.com/Daydreamer-riri/vite-react-ssg)** — prerenders every
  route to static HTML at build time (via `react-router-dom` v6 data routes), so there's no
  SEO regression from moving to a client-rendered framework
- **Tailwind CSS v4**, utilities-only (no preflight) — `src/styles/site.css` is the original
  hand-written stylesheet and still owns all base typography; Tailwind is there for future
  interactive components (the chat-demo diagram) without the two fighting
- **Vite + React 19 + TypeScript**

## Run it

```bash
npm install
npm run dev
```

## Structure

- `src/App.tsx` — the route table. Route paths intentionally keep the literal `.html` that
  appears in the browser's address bar (e.g. `projects/rbac.html`), so the client-side router
  matches the URL after hydration. See the comment there and in
  `scripts/fix-html-ext.mjs` for why that needs a small postbuild fixup.
- `src/pages/**` — one component per route. The content-only pages (`Home`, everything under
  `projects/` and `system-design/`) were generated once by `scripts/migrate.mjs` from the
  original static HTML files and are otherwise plain React from here on.
- `src/components/Seo.tsx` — per-page `<title>`/description/canonical/OG/JSON-LD, wraps
  vite-react-ssg's `<Head/>` so it's baked into the static HTML at build time.
- `scripts/migrate.mjs` — one-off content migration from the old static HTML. Not part of the
  build; kept as a record and in case another page needs the same treatment.
- `scripts/fix-html-ext.mjs` — postbuild step, run automatically by `npm run build`.

## Build

```bash
npm run build
```

Outputs to `dist/`, one static HTML file per route, matching the site's existing URL
structure exactly (`/`, `/projects/*.html`, `/system-design/`, ...). This is what CI
(`.github/workflows/deploy.yml`) builds and syncs to S3.
