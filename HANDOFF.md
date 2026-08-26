# Adom Circle — Handoff Notes (updated)

> Read this first in a new chat. Everything about the project, deployment, and
> next steps is captured here.

## ✅ CURRENT STATUS — LIVE!

**The PWA is fully deployed and reachable at all addresses:**
- `https://www.adomcircle.org` ✅
- `https://adomcircle.org` ✅
- (both also work without https://)

Hosted on **Railway — Hobby plan (PAID, no sleep mode)**.
GitHub repo: **`adom-circle`**.
All other services (Supabase, Cloudinary, etc.) are on **free tiers** — user is budget-conscious and wants to be sure anything new works before committing.

## DNS / Domain state (Porkbun)

Records at Porkbun for `adomcircle.org`:
- ALIAS `adomcircle.org` → `dx36udsr.up.railway.app`
- CNAME `www.adomcircle.org` → `dx36udsr.up.railway.app`
- Wildcard CNAME `*` → `dx36udsr.up.railway.app` (this is what made www work)
- TXT `railway-verify=…` (code may have changed when domain re-added — match Railway's current code)
- Railway Custom Domain shows domain verified
- When adding domains in Railway: NO https:// — just the bare name

## RAILWAY VOLUME — NOT SET UP (important next task)

- User found the "Create Volume" screen (right-click service card → Attach Volume → Create Volume)
- The form shows ONLY a path field
- Paths `/app/.storage`, `/app/storage`, `/storage`, `app/.storage`, `.storage` all accepted (no red flag) BUT the **Create button stays disabled**
- No size field, no name field visible; nothing found via Settings either
- **Possible next approaches for the new chat:**
  1. Screenshot the actual form and look for hidden size/region requirements
  2. Try Railway → Settings → left sidebar → Volumes (newer UI)
  3. Railway docs: volumes may require size in newer UI, or the "More" (⋯) menu on the service
  4. **Fallback: move data to Supabase (free tier, always-on, no sleep)** — user has Supabase account. Replace `.storage/` file store with Supabase Postgres. Test locally FIRST (small data) before touching live site. Supabase free = 500MB, fine for text data. Railway Hobby stays as the only paid service.

## What is built (all working)

- Landing page (hero, quick-action links at top, socials row, showcase ads, events strip, civic pledge, community teaser, stories, final CTA)
- Community: 8 chatrooms (live updates via oRPC streaming), forum with threads/replies/likes/reports, delegated moderation (admins + room moderators)
- Projects: listing, detail modal, contributions (Time/Skills/Resources/Financial), submit-a-project flow, milestones, impact stats
- Events & Activities: upcoming/past, RSVP (+15 pts), VIP/moderator/admin can create, showcase ads (click-tracked)
- Civic: voter pledge (+20 pts), Constitution explainers, election timeline
- Economy hub: participation paths, principles, posts
- About: mission/vision/pillars/guidelines
- Admin panel: overview (analytics, top contributors, broadcast tool, DeepSeek rate card, bot-protection card), site content editor (hero, stats, socials, values, announcement, footer), members & roles (VIP/mod/partner, room delegation, points), projects manager, events & ads manager, posts manager, mailbox (demo email outbox), moderation (reports, rooms)
- Auth: real passwords (scrypt-hashed), email verification (6-digit code, demo outbox), password reset (6-digit code), session tokens, rate limiting, honeypot, reCAPTCHA v3 hook (demo mode)
- Ranks & points: 6-level ladder, badges, rank-up notifications, points for messages/threads/replies/contributions/RSVP/pledge/verify
- Notifications: bell with unread badge, auto-notify on replies/likes/new events/rank-ups/broadcasts
- Dark mode (follows system, remembers choice), 4 languages (EN/Twi/Ga/Ewe) via i18n
- PWA: manifest, service worker, installable, icons (3D "AC" logo)
- URL routing: hash-based (#/events, #/projects…) so each page has its own address + back button works + error boundary

## NEXT PRIORITIES

1. **DATA VOLUME / PERSISTENCE** (above) — top priority; data currently resets on redeploy
2. **DESIGN & TEXT POLISH** — user's stated next want: "polish the design and text etc" now that everything works. Premium $100k look, Ghana flag colors, unique branding
3. **Real email delivery** — currently demo mailbox (Admin → Mailbox shows codes). Wire Resend/SMTP into `src/server/rpc/members.ts` (sendEmail function)
4. **reCAPTCHA keys** — hook ready, demo mode now. Add `VITE_RECAPTCHA_SITE_KEY` (build-time) + `RECAPTCHA_SECRET_KEY`
5. **Social links** — user has FB page/group, WhatsApp channel, YouTube, TikTok. Update in Admin → Site content → socials (currently placeholder URLs)
6. **Cloudinary** — image hosting on free tier; image fields accept custom URLs already

## THE UPLOAD PROCESS (how updates reach the live site)

- **Local folder:** `C:\Users\sgyam\AppData\Roaming\Quests\workspace\projects\calm-true-bay-20\adom-circle`
- **Regenerate after changes:** run `ts scripts/clean-export.ts` (builds the folder from the live project; excludes chats/junk/data; includes `dist` + `output` + `src`)
- **Upload:** github.com → open repo `adom-circle` → delete contents (or delete repo in Settings → Danger Zone, recreate empty) → "uploading an existing file" → in File Explorer open the `adom-circle` folder → **Ctrl+A (select files INSIDE, NOT the folder)** → drag → Commit changes
- **Railway auto-redeploys** on GitHub changes; or Deployments → Redeploy
- ⚠️ GitHub Desktop is NOT installed / user prefers web upload
- ⚠️ Old stale folder `adom-circle-clean` exists in the workspace — ignore it, use `adom-circle`

## CRITICAL GOTCHAS

- `.quests/sessions.db` in project root = chat history. NEVER upload (clean-export excludes it; user had a scare with chats appearing on GitHub from an early web upload).
- `.storage/` = live data, gitignored, must NOT be uploaded.
- If user re-uploads everything, seeded demo data returns (fresh .storage on Railway).
- Railway service names are random (attractive-clarity etc.) — the keeper has the `dx36udsr.up.railway.app` URL / the `adom-circle` repo.
- This workspace's AI cannot view images (screenshots) — user must describe screenshots in words.

## Environment variables (for later)

- `RECAPTCHA_SECRET_KEY` + `VITE_RECAPTCHA_SITE_KEY` — enable reCAPTCHA v3 (currently demo mode)
- Real email provider (Resend/SMTP) — currently demo mailbox in Admin → Mailbox
- `VITE_API_URL` — only if frontend ever splits from API
- Railway sets `PORT` automatically (8080); server reads `process.env.PORT` (Dockerfile EXPOSE 3000 is just a label)
- Supabase (future): `SUPABASE_URL` + `SUPABASE_ANON_KEY` from Supabase → Project Settings → API

## Demo accounts (all password: `Adom@2026`)

- `admin@adomcircle.org` — admin (full panel)
- `kofi@example.com` — moderator (manages Youth & Education room)
- `yaw@example.com` — VIP (can create events)
- Others: akua, aba, kwame, efua, kojo, nana, sena, adwoa, fifi @example.com

## Testing / build commands

```bash
pnpm dev              # local dev
pnpm build            # production build
pnpm start            # run production server (NODE_ENV=production)
pnpm exec tsx scripts/prod-test.ts   # verify prod pipeline
ts scripts/smoke-test.ts             # verify data seeds
ts scripts/functional-test.ts        # 22 tests (auth, points, moderation…)
ts scripts/clean-export.ts           # regenerate upload folder (adom-circle)
```

## Files the new chat needs

- `HANDOFF.md` — this file (read first)
- `src/` — all client + server code
- `scripts/` — generators, tests, clean-export
- `DEPLOY.md` — deployment guide
- `package.json`, `Dockerfile`, `vite.config.ts` — build config
- `output/` — images & icons (regenerate with `ts scripts/generate-images.ts` + `ts scripts/generate-icons.ts` if ever missing)
- `adom-circle/` — the upload folder (regenerate via clean-export)

## Design notes

- Logo: custom 3D "AC" monogram — deep-green coin, gold A with Black Star, tricolour C ring (red→gold→green). Files: `src/client/lib/logo-svg.ts`, `logo.tsx`; icons in `output/icons`.
- Theme: light default, dark mode toggle; follows system preference until user chooses.
- Colors: Ghana flag palette (red #CE1126, gold #FCD116, green #006B3F) on warm cream.
- User wants premium $100k look; flag colors; unique brand.
