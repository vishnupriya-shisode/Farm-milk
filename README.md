# Farm Fresh Milk

[![e2e](https://github.com/vishnupriya-shisode/Farm-milk/actions/workflows/e2e.yml/badge.svg)](https://github.com/vishnupriya-shisode/Farm-milk/actions/workflows/e2e.yml)

A small milk-delivery management app for a family farm in Dhakephal delivering to homes in Aurangabad. It replaces the notebook-and-WhatsApp routine with a simple site: a public page for prospective customers, an admin panel for running the business, and a lightweight view for the delivery worker to mark off daily deliveries.

## Who uses it

- **Customers** see a marketing landing page (`/`) describing the farm, pricing, and how delivery works, with a call-to-action to get in touch.
- **Admin** (the family) logs in with a PIN and manages everything: customers, daily deliveries, payments, monthly billing, and login PINs.
- **Delivery worker** logs in with their own PIN to see today's round and mark each customer as delivered, skipped, or given extra.

There's no self-serve signup — the admin logs in with a PIN, and the worker logs in with a separate PIN that only the admin can set or change.

## Features

- **Customers** — add/edit customers with default morning/evening quantities, rate per liter, status (active/paused), and temporary quantity overrides for a date range (e.g. "away next week").
- **Deliveries** — a day-by-day board for marking each customer delivered, skipped, or given extra milk; usable by both the admin and the worker.
- **Payments** — record cash/PhonePe/other payments per customer and see who's still pending.
- **Billing** — monthly statements per customer: total liters, total amount, paid vs. pending.
- **Settings** (`/admin/settings`) — the admin can change their own login PIN or the delivery worker's PIN, confirming with their current PIN each time.
- **Bilingual** — every screen is available in English and Marathi (`src/lib/i18n`), switched via a cookie.

## Tech stack

- [Astro](https://astro.build) 7 (server output) with Astro Actions for forms/mutations
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) as the database (`data/milk.db`), schema in `src/lib/db/schema.sql`
- [Tailwind CSS](https://tailwindcss.com) 4 for styling
- [@astrojs/vercel](https://docs.astro.build/en/guides/deploy/vercel/) adapter for deployment on Vercel
- Session cookies signed with HMAC, PINs hashed with scrypt (`src/lib/auth/session.ts`)
- [Playwright](https://playwright.dev) for end-to-end tests, run in CI via GitHub Actions

## Getting started

```sh
npm install
npm run dev
```

The app runs at `http://localhost:4321`. On first run it creates `data/milk.db` and seeds two accounts:

| Role   | Default PIN | Env var to override |
| :----- | :---------- | :------------------- |
| Admin  | `1234`      | `ADMIN_PIN`           |
| Worker | `5678`      | `WORKER_PIN`          |

Change either PIN afterwards from `/admin/settings` — no need to touch the database directly. Other env vars: `SESSION_SECRET` (signs the login session, set a real value in production) and `DATABASE_PATH` (defaults to `data/milk.db`).

This project's `CLAUDE.md`/`AGENTS.md` asks agents to run the dev server in background mode:

```sh
astro dev --background   # astro dev stop / status / logs to manage it
```

## Commands

| Command             | Action                                                |
| :------------------- | :---------------------------------------------------- |
| `npm install`         | Install dependencies                                   |
| `npm run dev`          | Start the local dev server at `localhost:4321`         |
| `npm run build`        | Build for production                                    |
| `npm run preview`      | Preview the production build locally                     |
| `npm run test:e2e`     | Run the Playwright end-to-end suite (`tests/e2e`)        |
| `npm run astro ...`    | Run Astro CLI commands (e.g. `astro check`)              |

## Testing

`npm run test:e2e` runs the Playwright suite in `tests/e2e/`, which currently covers the admin PIN-management flow end to end (rejecting a wrong current PIN, changing the worker's PIN, changing the admin's own PIN, and logging in with the new PINs). It spins up an isolated dev server on port 4322 against a throwaway SQLite database so it never touches your local `data/milk.db`. The same suite runs in GitHub Actions on every push and pull request to `main` (`.github/workflows/e2e.yml`).

## Project structure

```text
src/
├── actions/          Astro Actions — login, PIN changes, customers, deliveries, payments
├── lib/
│   ├── auth/          Session tokens + PIN hashing (scrypt)
│   ├── db/             better-sqlite3 client, schema, and per-table queries
│   └── i18n/           English/Marathi dictionaries + t() helper
├── layouts/           Public + admin page shells
├── middleware.ts      Session lookup and role-based route protection
└── pages/
    ├── index.astro     Public landing page
    ├── login.astro      PIN login (admin or worker)
    ├── worker/          Delivery worker's daily view
    └── admin/            Dashboard, customers, deliveries, payments, billing, settings
tests/e2e/            Playwright specs
```

## Deployment

Deploys to [Vercel](https://vercel.com) via the `@astrojs/vercel` adapter (`astro.config.mjs`). Set `ADMIN_PIN`, `WORKER_PIN`, and `SESSION_SECRET` as environment variables on the Vercel project before the first deploy — they seed and secure the login PINs.
