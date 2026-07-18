# Bond — Vercel Deployment Guide

## Prerequisites

- A Vercel account (free tier works perfectly)
- The project pushed to a GitHub/GitLab/Bitbucket repository
- Your Supabase project URL and anon key (already in `.env`)

## Step 1 — Push to Git

Push the entire project to a Git repository:

```bash
git init
git add -A
git commit -m "Initial commit: Bond app"
git remote add origin <your-repo-url>
git push -u origin main
```

## Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New Project**.
3. Select your repository.
4. Vercel auto-detects Vite — keep these settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

## Step 3 — Add Environment Variables

In the Vercel project settings, go to **Settings → Environment Variables** and add these two:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://0ec90b57d6e95fcbda19832f.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw` |

These are the only two variables needed. Both are client-safe (protected by Supabase RLS policies). No server-only keys are required on Vercel.

## Step 4 — Deploy

Click **Deploy**. Vercel builds and deploys the app. You get a `*.vercel.app` URL.

## Step 5 — Custom Domain (Optional)

In **Settings → Domains**, add your custom domain and follow DNS instructions.

## Environment Variables Reference

### Required (client-side, prefixed with VITE_)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://0ec90b57d6e95fcbda19832f.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw` |

### Not needed on Vercel (server-only, already in Supabase)

| Variable | Why |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Only for edge functions / server scripts — already configured in Supabase |
| `SUPABASE_DB_URL` | Only for direct DB access — already configured in Supabase |

## Vercel Free Plan Compatibility

- No server-side functions required (all backend is Supabase)
- Static build output (Vite SPA)
- PWA with offline support via service worker
- No bandwidth-heavy features
- Small bundle size (~130 KB gzipped total)

## Post-Deployment Checklist

- [ ] App loads without errors
- [ ] Sign-up flow works (creates account + profile)
- [ ] Onboarding completes (name + emoji)
- [ ] Partner code generates and displays
- [ ] Two accounts can pair via partner codes
- [ ] Dashboard shows partner status
- [ ] Timeline accepts notes/moods/milestones
- [ ] Chat sends and receives messages
- [ ] Realtime updates work (open two browsers)
- [ ] PWA installs on mobile (Add to Home Screen)
- [ ] Offline mode works (disable network, reload)
