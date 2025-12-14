# QuickSync Benchmarks Web (Vite + React)

Static site built with **Vite 7 + React 19** and deployed to **Cloudflare Pages**.

## Development

```bash
cd web
npm install
npm run dev
```

## Build

```bash
cd web
npm run build
```

Build output is written to `web/dist/`.

## Tests

```bash
cd web
npm test
```

## Lint / Typecheck

```bash
cd web
npm run lint
npm run typecheck
```

## E2E (Playwright)

```bash
cd web
npx playwright install chromium
npm run e2e
```

## Environment variables

- `PUBLIC_API_URL` (optional): API base URL (defaults to `https://quicksync-api.ktz.me`)
- `USE_PRODUCTION_DATA=true|false` (dev only): opt into using the production R2 dataset instead of `web/public/test-data.json`

By default, localhost/dev uses `web/public/test-data.json` (a small sample of the production dataset) so you can work offline.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

SPA routing fallback is handled via `web/public/_redirects`.
