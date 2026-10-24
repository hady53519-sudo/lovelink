# LoveLink

Create personalised romantic surprise pages (letter, photos, memories, song, **funny love games**, final reveal) and share them with a unique, unguessable link. Arabic (RTL) and English (LTR) throughout.

**Made by Hady Hesham**

Stack: React 18 + Vite + TypeScript · plain CSS (logical properties for RTL/LTR) · Supabase (PostgreSQL, Auth, Storage).

---

## What works now vs. what you must set up

| Area | Status |
|---|---|
| All 8 pages, bilingual UI, RTL/LTR, mobile menu, themes, live preview, validation, floating hearts | ✅ Implemented. Works with no backend (builder + preview + examples). |
| Love games: runaway "No" button, scratch-card coupons, wheel of fate | ✅ Implemented (client-side, no backend needed to play). |
| Accounts, saving drafts, publishing, editing, deleting, photo upload, share link/QR | ✅ Code complete, **needs your Supabase project** (steps below). Until then the app shows a clear setup notice and disables saving. |
| Password protection | ✅ Enforced by the database (bcrypt hash in a table no API role can read, throttled to 8 failures / 15 min / page). **Needs migrations 001–004.** |
| Photos on password-protected pages | ✅ Work with no extra service. The server returns photo links only after the password is verified (see step 4 for the model and its limit). |
| Per-page social preview cards (Open Graph) | ⚠️ **Not included.** This is a client-rendered SPA, so scrapers (WhatsApp, X, Facebook) only see the generic site tags in `index.html` (title, description, `/og-image.svg`). Many scrapers ignore SVG, so replace it with a 1200×630 PNG. Per-page cards need server rendering, e.g. a Vercel Edge Middleware or Supabase Edge Function that returns tags for `/s/:slug`. Do **not** put private names or titles in such tags for protected pages. |
| Rate limiting | ⚙️ Partly built in (password attempts, 30 pages/account, 12 photos/page, 5 MB/file). See [Rate limits](#rate-limits). |
| Email sending (confirmation mails) | ⚙️ Supabase's built-in mailer works for testing but is heavily limited; configure your own SMTP for production. |
| Automated tests | ✅ Unit tests for validation, URL parsing, file sniffing, games and translation parity. No end-to-end tests against a real Supabase project were run. |

> Nothing in this repository claims a backend is "live". Until you add credentials the app runs in preview-only mode.

---

## Upgrading from the first version (the one with `001_init.sql`)

**Quickest:** paste `supabase/UPGRADE_ALL_IN_ONE.sql` into the SQL Editor and run it once (one transaction: all or nothing). It does steps 1–3 below.

If your Supabase project already has the old schema, **do not** run migrations 001–004 directly. Use `supabase/upgrade-from-old-version/` instead:

1. `step1_before_new_migrations.sql`: renames the old tables to `*_legacy` (nothing is deleted), removes the old public read function, and makes the old public `photos` bucket private.
2. Run `supabase/migrations/001` → `004` as usual.
3. `step2_import_old_data.sql`: copies surprises into the new tables, keeping ids, public links and passwords.

Not migrated: photos (re-add them in the editor; the old list stays in `photos_legacy`) and song/video links that are not https YouTube/Spotify/Vimeo (left empty; the notice shows how many). The old website stops working after step 1, so deploy the new version right after step 3.

---

## 1. Run locally

Requirements: Node 18+.

```bash
npm install
cp .env.example .env.local   # then edit it (see step 3)
npm run dev                  # http://localhost:5173
```

Other scripts: `npm run typecheck`, `npm test`, `npm run build`, `npm run preview`.

## 2. Create the Supabase project

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run these files **in order** (or use `supabase db push` with the CLI):
   1. `supabase/migrations/001_schema.sql` – tables, constraints, indexes, triggers
   2. `supabase/migrations/002_functions.sql` – `get_public_surprise()` and `set_surprise_password()`
   3. `supabase/migrations/003_rls.sql` – Row Level Security
   4. `supabase/migrations/004_storage.sql` – private `surprise-media` bucket (5 MB, JPG/PNG/WebP only) + storage policies

   Run them once, on a fresh project. The files are not written to be re-run after data exists.
3. **Authentication → Providers → Email** is on by default. Choose whether to require email confirmation (recommended for production). Under **URL Configuration** set *Site URL* to your site and add `http://localhost:5173` to *Redirect URLs*.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

## 3. Environment variables

`.env.local` (never committed):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
VITE_SITE_URL=http://localhost:5173      # your real origin in production, no trailing slash
VITE_CONTACT_EMAIL=you@example.com       # optional, shown in the Privacy Policy
```

Only the public anon key is ever used in the browser. **Never** put the `service_role` key in a `VITE_` variable or in any frontend file. Anything prefixed `VITE_` is shipped to every visitor.

## 4. Storage bucket

Created by migration 004. Check **Storage → surprise-media**: *Public bucket* must be **off**, limit 5 MB, allowed types `image/jpeg, image/png, image/webp`. Path convention: `<owner_id>/<surprise_id>/<random-uuid>.<ext>`.

How files are served (no Edge Function needed):
- The bucket is private and has **no public read policy**, so nobody can list or guess files.
- When you save a page (or open **My surprises**), your browser creates a signed link per photo (valid 1 year) and stores it in `surprise_photos`. Links are renewed automatically when fewer than ~120 days remain.
- The `get_public_surprise` function returns those links only for published pages and, for password-protected pages, only after the correct password.
- **Honest limit:** a link is a capability. Someone who already got it (after the password) can reuse it until it expires or the file is deleted. Deleting a photo or the page removes the file and kills its link.

**Already ran the older SQL?** Run `supabase/migrations/005_photo_urls.sql` once in the SQL Editor, deploy the new code, then log in and open **My surprises** once so existing photos get their links (or just re-save the page).

## 5. (Removed)

The old `protected-media` Edge Function is no longer used. Delete it from your Supabase project if you deployed it.

## 6. Deploy the site

Build output is static (`dist/`). Single-page routing needs a fallback to `index.html`; both configs are included, together with security headers and a Content-Security-Policy that allows only Supabase, YouTube (nocookie), Spotify and Vimeo embeds.

**Vercel** – import the repo, framework preset *Vite*, add the 3–4 environment variables, deploy. `vercel.json` is picked up automatically.

**Netlify** – import the repo; `netlify.toml` sets the build command, publish directory and redirect. Add the same environment variables.

Set `VITE_SITE_URL` to the final domain **before** building (it is baked into share links and QR codes), then add that domain to the Supabase *Redirect URLs*.

Production check:

```bash
npm run typecheck && npm test && npm run build && npm run preview
```

---

## Love games

Configured in builder step 5 (**Extras → Love games**), all optional and independent:

- 🏃 **Runaway button** – a question (default "Do you love me?"); the "No" button dodges the finger/cursor, shows funny messages, and after 7 tries gives up and becomes "Yes".
- 🎟️ **Love coupons** – up to 8 scratch cards revealing joke coupons ("One free hug, no questions asked"). Includes a keyboard-accessible *Reveal* button.
- 🎡 **Wheel of fate** – 2–8 slices (rewards or silly dares). The winner is chosen with `crypto.getRandomValues`; reduced-motion users get a short spin.

Funny example texts are provided in both languages and can be loaded with one click. Game text is stored in the `surprises.games` JSONB column (validated by constraints and a trigger) and returned by `get_public_surprise()`.

## Security model

- **RLS everywhere.** `anon` has no table privileges. Owners can only select/insert/update/delete rows where `owner_id = auth.uid()`.
- **Public reads only through `get_public_surprise(slug, password)`**, a `SECURITY DEFINER` function that returns only intended public fields, only for `published` pages, and never the owner id, password hash or timestamps.
- **Password protection is enforced server-side.** Content of a protected page is not returned until the bcrypt check passes. Hashes live in `surprise_secrets` (RLS on, no policies). Failed attempts are logged and throttled per page.
  Limit worth knowing: the throttle is per page, not per IP, so an attacker can lock out the legitimate visitor for 15 minutes. Use long random passwords and, for production, add IP-based limits at your CDN/WAF.
- **Unguessable links.** 14-character slugs from `gen_random_bytes` (~81 bits), never sequential. Pages are `noindex`.
- **Uploads.** Client checks size, MIME type *and* magic bytes; bucket enforces size and MIME; paths are random UUIDs under the owner's folder; a trigger rejects metadata whose path does not belong to the owner.
- **No unsafe HTML.** User text is only ever rendered as React text. No `dangerouslySetInnerHTML`. Media URLs are parsed against an allow-list (YouTube, Spotify, Vimeo, `https` only) and turned into official embed URLs; embeds load only after a click, are sandboxed, and never autoplay.
- **Final surprise message is not secret.** It is part of the page data delivered to anyone who can open the page; the button is a reveal, not protection.
- **Deletion.** *My surprises → Delete* removes all the page's files from Storage, then the page (photo rows cascade). Deleting the account in Supabase removes everything it owns.

## Rate limits

Built in: 8 failed password attempts / 15 min / page; max 30 surprises per account; 12 gallery photos + 1 background per page; 5 MB per image.

Not built in, configure in Supabase/your host:
- **Auth → Rate Limits**: sign-ups, sign-ins and emails per hour.
- **Captcha** (Auth → Attack Protection) to stop automated sign-ups.
- Per-IP limits on the REST/RPC endpoints and the Edge Function via Cloudflare, Vercel Firewall or similar.
- Storage quota alerts in the Supabase dashboard.

## Project structure

```
supabase/
  migrations/001–005_*.sql      schema, RPC functions, RLS, storage, photo links
src/
  i18n/            en.ts, ar.ts (type-checked to have identical keys), provider
  lib/             validation, media URL parsing, file checks, formatting, examples
  services/        surprises (save/load/delete), public (RPC + photo URLs), media
  hooks/           useAuth
  components/      Layout, SurpriseView, ShareScreen, Field, Modal, Toast, games/, builder/
  pages/           Home, Builder, SurprisePage, ExamplePage, Dashboard, Login, About, Legal, NotFound
  styles/global.css
```

## Notes for further development

- Per-page Open Graph tags (see table above).
- Generate typed DB clients with `supabase gen types typescript` to replace the manual row types in `services/`.
- The legal pages are sensible starting text, not legal advice. Have them reviewed for your jurisdiction.
- Music and video are embedded from their platforms only; nothing is downloaded or re-hosted.

## Troubleshooting

- **Chrome says "eval blocked by Content Security Policy"** – the app never uses `eval`. The message comes from a browser extension or the Vercel toolbar. Ignore it; keep `script-src 'self'` in the CSP.
- **Photos missing on an old page** – log in, open **My surprises** once (renews links), or re-save the page.
