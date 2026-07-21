# QuaLead AI — React frontend

A premium client UI for the LeadPipe Doctor pipeline, built as a **Vite +
React + TypeScript + Tailwind** SPA. It's a pure presentation layer: it
consumes the existing FastAPI endpoints and holds no business logic of its
own, so the Python pipeline (cleaning, validation, dedup, scoring,
self-healing) is untouched. This runs *alongside* the Streamlit dashboard,
not instead of it.

## Stack
- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** for styling (design tokens in `tailwind.config.js`)
- **TanStack Query** for data fetching/caching against the API
- **Recharts** for charts; a couple of custom SVG/CSS charts (butterfly, gauge)
- **Plus Jakarta Sans** self-hosted via `@fontsource` (no CDN)
- **react-router-dom** for the left-drawer navigation

## Pages
`Overview` · `Leads` (searchable table + per-lead diagnosis gauge) ·
`Lead Analytics` (funnel, score distribution, avg-by-source, signal radar,
top leads) · `Data Quality` · `Self-Healing` · `Upload Leads`
(drag-and-drop CSV → `POST /ingest/csv`).

## Run it

### Dev (hot reload)
```bash
cd frontend
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                   # http://localhost:5173
```
The FastAPI service must be running (`docker compose up -d api`, or bare
`uvicorn app.main:app`). CORS for `:5173/:4173/:8080` is already enabled in
`app/main.py` (override with the `CORS_ALLOW_ORIGINS` env var).

### Production build
```bash
npm run build                 # tsc typecheck + vite bundle -> dist/
npm run preview               # serve dist/ on http://localhost:4173
```

### Docker (part of the stack)
```bash
docker compose up -d          # frontend served at http://localhost:8080
```
`VITE_API_BASE_URL` is baked at build time and must point at a URL the
**browser** can reach (default `http://localhost:8000`), not the internal
`api` service name.

## Notes
- `import.meta.env.VITE_API_BASE_URL` is the single API-base knob (`src/lib/api.ts`).
- Data types mirror `app/schema/canonical.py:Lead` in `src/lib/types.ts`.
- Charts read from `src/lib/derive.ts`, which recomputes bands/funnels/radar
  from the raw leads the same way the backend's scorer does.
