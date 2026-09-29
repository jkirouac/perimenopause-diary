# Daily Perimenopause Diary

A phone app for keeping the CeMCOR **Daily Perimenopause Diary** each evening, with a month grid and a printable copy for a doctor.

Based on the Daily Perimenopause Diary © Jerilynn C. Prior, Centre for Menstrual Cycle and Ovulation Research (CeMCOR), University of British Columbia — https://cemcor.ubc.ca. CeMCOR permits copies for personal or clinical use with authorship credited and not for profit; this project is personal and non-commercial.

## How it works
- Installable web app (Vite + React + TypeScript + vite-plugin-pwa), hosted on GitHub Pages.
- Accounts and data in Supabase (Canada Central). Sign-in is a 6-digit emailed code. Row-level security keeps each person's diary private to them.
- Saves go through an outbox on the phone, so entries made offline are sent later.

## Develop
1. `npm install`
2. Create `.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and (for scripts) `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run dev` and open http://localhost:5173/perimenopause-diary/

## Checks
- `node --env-file=.env.local scripts/check-privacy.mjs` — two throwaway accounts try to read each other's data.
- `node --env-file=.env.local scripts/walkthrough.mjs <dir>` — drives the app at phone size (dev server running) and saves screenshots.

Database changes live in `supabase/migrations`; apply with `npx supabase db push`.
