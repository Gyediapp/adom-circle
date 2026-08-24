# Adom Circle — Deploy Checklist (Railway-first, your stack)

Everything is ready to ship. This is the exact plan for **your** stack:
Railway (host) · Vercel (optional frontend later) · Supabase (future DB) ·
Clerk (future auth) · Cloudinary (images now).

---

## 1. Architecture — where each tool fits

```
                ┌──────────────────────────────────────────┐
  adomcircle.org │  RAILWAY (the whole app today)           │
        │        │  • Hono server (API + pages + SW)        │
        ▼        │  • Built client bundle (dist/)           │
  ┌─────────┐    │  • .storage/ = your data (persistent)    │
  │  DNS    │───▶│  • /output images served                 │
  └─────────┘    └──────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
   Cloudinary      Supabase (later)    Clerk (later)
   images now      DB when you grow    auth if you switch
```

**Why Railway and not Vercel for now:** your data lives in files (`.storage/`).
Railway gives you a **persistent volume** — data survives restarts. Vercel
functions are ephemeral (data would vanish). One server on Railway = simplest
and free-tier friendly. Split to Vercel (frontend) + Railway (API) later if
you want — the app supports it via `VITE_API_URL`.

---

## 2. Railway deploy (15 minutes, free tier)

1. **Push your repo to GitHub** (git init → add → commit → push to a new repo).
2. **Railway** → New Project → **Deploy from GitHub repo** → select the repo.
   - Railway auto-detects the `Dockerfile`. (It also auto-installs pnpm.)
3. **Add a volume** (critical!):
   - In your service → **Volumes** → New Volume → mount at **`/app/.storage`**.
   - Without this, members/projects vanish on every redeploy.
4. **Environment** (Settings → Variables):
   - `NODE_ENV=production`
   - Railway sets `PORT` automatically.
   - Add reCAPTCHA keys later if you want (optional).
5. **Deploy.** Railway builds the Docker image and runs `pnpm start`.

**Free-tier notes:** Railway gives trial credit; one small service fits well.
When credits run low, keep the volume, pause the service, restart cheaply.

---

## 3. Custom domain — the DNS form you asked about

In Railway: **Settings → Networking → Custom Domain →** add `adomcircle.org`.
Railway then shows you the **exact record to create**. Fill your registrar's
form like this (values shown are examples — **copy what Railway displays**):

| Field | Value (typical) |
|---|---|
| Type | **CNAME** (or A, if Railway gives you an IP) |
| Host | **@** (for the root) — then add another with **www** |
| IPv4 Address / Target | **your-app.up.railway.app** (CNAME) — or the **A-record IP** Railway shows |

Then in Railway, also add **`www.adomcircle.org`** → create the `www` CNAME.
HTTPS is automatic on Railway (free Let's Encrypt).

> If your registrar only offers A records for the apex (some do), use the
> **A-record IP** Railway provides instead of a CNAME — the form stays the same.

**Check it worked:** `nslookup adomcircle.org` — the IP/target should match
what Railway shows. Propagation takes 24–48h.

---

## 4. Cloudinary — images (use now, free tier)

1. Sign up (free 25 GB) → get your cloud name.
2. Upload images in the Cloudinary dashboard → copy the **delivery URL**
   (they look like `https://res.cloudinary.com/<cloud>/image/upload/...`).
3. Paste that URL into Adom Circle:
   - **Admin → Site content** (hero image, values, socials, ads) — every image field now has a "paste custom URL" box.
   - **Submit project / Organise event** forms — same.
4. Images load via Cloudinary's CDN — fast on Ghanaian networks.

---

## 5. Supabase & Clerk — when to bring them in

| Tool | Today | Later (when you grow) |
|---|---|---|
| **Supabase** | Not needed — `.storage/` on the Railway volume works and is free | Migrate data to Supabase Postgres (members, projects, messages) — I'll build the migration when you're ready |
| **Clerk** | Keep built-in auth (passwords + email verify + reset + sessions — all tested) | Swap auth providers if you want social login (Google/Facebook) — a config-level change |

Don't add them yet — more moving parts = more cost and complexity on free tier.

---

## 6. After launch (same-day)

- [ ] Visit from a **phone** → Add to Home Screen → confirm install + offline.
- [ ] **Admin → Mailbox**: sign up a fresh account → see the verification email.
- [ ] Point the social links (Admin → Site content) at your real channels.
- [ ] Add **UptimeRobot** (free) to ping `https://adomcircle.org`.

## 7. Week-one hardening

- [ ] Real email delivery (Resend free tier — wire into `sendEmail()`).
- [ ] reCAPTCHA keys (2 env vars — instructions in `.env.example`).
- [ ] **Cloudflare** in front (free): CDN, bot fight, DDoS, HTTPS.
- [ ] Backup the volume (Railway snapshots, or `rsync` .storage to Cloudinary/Backblaze).

---

## Commands reference

```bash
# local dev
pnpm dev

# build + run exactly like Railway
pnpm build
pnpm start          # NODE_ENV=production tsx src/server/index.ts

# verify the production pipeline locally
pnpm exec tsx scripts/prod-test.ts
```
