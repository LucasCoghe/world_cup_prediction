# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"WK Pronostiek" — a World Cup 2026 prediction game web app (Dutch language). Users register, predict match scores for all 104 matches (72 group + 32 knockout), and earn points based on scoring rules inspired by the "Stockx" system. Includes a leaderboard, beer penalty system (lowest daily scorer drinks), group chat, push notifications, and a bracket simulator.

## Commands

- **Dev server:** `npm run dev` (Next.js on localhost:3000)
- **Build:** `npm run build` (runs `prisma generate && next build`)
- **Lint:** `npm run lint` (ESLint with next/core-web-vitals + typescript)
- **Run scripts:** `npx tsx scripts/<script>.ts` (e.g., `npx tsx scripts/seed-test-data.ts`)
- **Prisma generate:** `npx prisma generate`
- **Prisma migrate:** `npx prisma migrate dev`

## Architecture

**Next.js 16 App Router** with a single-page client-side app pattern:
- `src/app/page.tsx` is the only page — renders `AuthScreen` or `Dashboard` based on JWT auth state
- `Dashboard` uses tab navigation to switch between components (no client-side routing)
- All data flows through Next.js Route Handlers (`src/app/api/...`)
- Auth is JWT-based with HTTP cookies (`src/lib/auth.ts`), no middleware — each API route calls `getUser()`

**Database:** PostgreSQL via Prisma ORM (`prisma/schema.prisma`). Local dev uses `prisma/dev.db` (SQLite) but production uses Postgres via `POSTGRES_URL` env var. Singleton Prisma client in `src/lib/db.ts`.

**Tournament data** is hardcoded in `src/lib/tournament.ts` — all 48 teams, 72 group matches, and 32 knockout matches with real FIFA 2026 dates/times (CEST). Key constants: `TOTAL_GROUP_MATCHES = 72`, `TOTAL_MATCHES = 104`.

**Core logic modules in `src/lib/`:**
- `scoring.ts` — point calculation (1pt correct outcome, +2pt exact score, joker bonuses/penalties)
- `standings.ts` — group standings calculation with FIFA tiebreakers, best-third-placed resolution, and knockout bracket resolver using backtracking for 3rd-place slot assignment
- `tournament.ts` — all static match/team data, match locking (predictions lock at kickoff), deadline formatting

**Predictions flow:** Client uses `usePredictions` hook (`src/hooks/usePredictions.ts`) → auto-saves to `POST /api/predictions` with debounce. Server enforces match locking (can't change after kickoff) and joker limits (3 group, 2 knockout).

**Beer system:** Leaderboard API (`/api/leaderboard`) computes beer penalties — lowest daily scorer in group phase, lowest round scorer in knockout, and 3-consecutive-zero-point-matches penalty.

**PWA:** Service worker registration, push notifications via `web-push`, install prompt. Deployed on Vercel with `@vercel/analytics`.

## Key Patterns

- Path alias: `@/*` maps to `./src/*`
- All UI text is in Dutch
- Admin-only routes check `user.isAdmin` from JWT
- Knockout match sources use codes like `1A` (1st in group A), `W73` (winner of match 73), `3RD_ABCDF` (best 3rd from those groups)
- Match locking is time-based: predictions for a match lock at its kickoff time
- Tailwind CSS v4 via `@tailwindcss/postcss`
