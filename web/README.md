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

## Environment variables

- `PUBLIC_API_URL` (optional): API base URL (defaults to `https://quicksync-api.ktz.me`)
- `PUBLIC_TEST_DATA=true` (optional): use `web/public/test-data.json` instead of the R2 dataset

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

SPA routing fallback is handled via `web/public/_redirects`.

