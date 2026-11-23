# Frontend — Medical Marketplace

Next.js 16 App Router + React 19 + Tailwind 4. See the [root README](../README.md)
for the full picture.

> This project runs a Next.js version whose conventions differ from older
> releases — `AGENTS.md` in this directory explains where to find the bundled
> docs. Dynamic route params are promises; client components use `useParams()`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `:3000` |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |

Set `NEXT_PUBLIC_API_URL` in `.env.local` (see `.env.example`).

## Layout

```
src/
├── app/
│   ├── (shop)/          customer marketplace — mobile-first chrome
│   ├── admin/           platform admin
│   ├── vendor/          wholesaler
│   ├── retailer/        medical shop
│   └── login, register, forgot-password, notifications
├── components/
│   ├── ui/              button, input, modal, table, badges, status pills
│   ├── charts/          Recharts wrappers and the KPI tile
│   ├── layout/          dashboard shell and marketplace shell
│   └── *-workspace.tsx  inventory, finance, reports, catalogue, invoices
├── hooks/               useListQuery, useDebouncedValue
├── lib/                 api client, query keys, formatters, types
└── store/               auth and location (Zustand)
```

## Conventions

- **One API client.** `lib/api-client.ts` handles auth headers, a single shared
  token refresh, error normalisation and file downloads. Do not call `fetch`
  directly.
- **Query keys come from `lib/query-keys.ts`.** Mutations invalidate by module
  prefix (`queryKeys.retailer.all`), which keeps dashboards and lists in sync.
- **Shared workspaces over duplication.** Vendor and retailer screens for
  inventory, finance, reports, invoices and catalogue are the same component
  mounted with a different scope and base path.
- **No setState in effects.** State is derived, seeded via keyed remounts, or set
  in the event handler that caused the change. The lint rule is enforced.
