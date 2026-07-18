# Bond — Deployment Guide

A private space for two. Stay close, grow together.

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions)
- **PWA**: Installable, offline-capable via vite-plugin-pwa
- **State**: Zustand

## Project Structure

```
src/
  components/    Shared UI (AppShell, BraceletLogo)
  lib/           Supabase client, auth store, presence hook, emoji utils
  screens/       Route-level screens (Auth, Onboarding, Pairing, Dashboard, Timeline, Chat, Settings)
  App.tsx        Router + auth gate
  main.tsx       Entry point
supabase/
  functions/     Edge functions (bond-ai)
  migrations/     Database migrations (profiles, timeline, presence, messages)
public/          Static assets (favicon, icons, robots.txt)
```

## Environment Variables

Two required variables (already set in `.env`):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://0ec90b57d6e95fcbda19832f.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw` |

## Database Schema

Four tables with Row Level Security (RLS):

1. **profiles** — user profiles with partner codes and pairing
2. **timeline** — shared moments (notes, moods, milestones)
3. **presence** — online status tracking
4. **messages** — 1:1 chat between paired partners

## Edge Functions

- **bond-ai** — Returns daily relationship tips and responds to prompts. Deployed via Supabase MCP.

## Building for Production

```bash
npm run build
```

Output is in `dist/`. The build is optimized:
- Manual chunk splitting (vendor, supabase)
- ES2020 target
- Tailwind purges unused styles
- PWA service worker precaches all assets

## Deploying to Vercel

See `VERCEL_SETUP.md` for step-by-step instructions. The app is fully compatible with the Vercel free plan — no server-side functions required, all backend runs on Supabase.

## Offline Support

The app uses vite-plugin-pwa with Workbox to precache all static assets. Once loaded, the app shell works offline. Realtime features (chat, presence) require a network connection, but cached data is displayed from the last session.
