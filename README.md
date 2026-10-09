# LoveLink ♥ — Made by Hady Hesham

React + Vite + TypeScript frontend, Supabase backend (Postgres, Storage, Auth). Arabic (RTL) / English (LTR).

## Setup
1. Create a free project at supabase.com.
2. **Authentication → Providers → enable "Anonymous sign-ins"** (owners are anonymous users; this is what lets people create pages without an account).
3. **SQL Editor** → paste and run `supabase/migrations/001_init.sql` (tables, RLS, password-check function, `photos` bucket + storage policies).
4. `cp .env.example .env` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Use the **anon** key only — never the service-role key.
5. `npm install && npm run dev`
6. Production: `npm run build` (output in `dist/`).

## Deploy
- **Vercel:** import repo, add the two env vars, deploy (`vercel.json` handles SPA routing).
- **Netlify:** build `npm run build`, publish `dist`, add the two env vars (`public/_redirects` handles routing).

## Security notes
- Public pages are read only through the `get_surprise` SQL function; the password is verified on the server (bcrypt) and hidden content is not returned until it matches. Table rows are visible only to their owner (RLS).
- Photos live in a **public** bucket under unguessable paths (`<user-id>/<uuid>.ext`). Password-protected pages hide the photo list, but anyone who already knows a file URL can open it.
- Anonymous accounts are tied to the browser: clearing site data loses access to "My Pages". Add email login later if you need cross-device access.
- Rate limiting: enable Supabase Auth rate limits + CAPTCHA (Authentication → Settings) and consider an Edge Function in front of `get_surprise` to throttle password guesses.

## Implemented
Bilingual UI + switcher, themes, 3-step builder with live preview, validation, image preview, photo upload (type/size checks), drafts + publish, unguessable links, copy / native share / QR, YouTube & Spotify embeds (click-to-play), password protection (server-side), final reveal button, My Pages with delete (removes files), About / Privacy / Terms / 404.

## Not implemented yet
Editing a page after saving, memory timeline, animated greeting cards, per-page social preview images (needs an Edge Function/SSR because this is a SPA), email accounts, automated tests.
