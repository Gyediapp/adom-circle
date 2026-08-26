# Adom Circle 🇬🇭

**Ghana's circle of values, civic duty & progress.** A civic and social platform uniting Ghanaians at home and abroad — under one Constitution, above every institution.

Live at **[adomcircle.org](https://adomcircle.org)** — deployed on Railway, data persisted in Supabase Postgres.

## What's inside

- **Community** — live chat rooms & a forum across 8 circles (General, Youth & Education, Health & Welfare, Business & Economy, Civic & Voting, Diaspora, Faith & Values, Projects & Volunteering)
- **Projects & impact** — volunteer-driven initiatives tracked transparently (volunteers, hours, regions, milestones)
- **Events** — meetups, workshops, fundraisers and volunteer days with RSVP (+15 points)
- **Civic & voting** — non-partisan voter education, the Voter's Pledge, and Constitution-first values
- **Economy hub** — invest, remit, buy Ghanaian
- **Members & ranks** — a 6-level ladder (New Member → Ambassador) earned through real contributions
- **Admin panel** — manage site content, members, projects, events, ads, posts and moderation in one place
- **i18n** — English, Twi, Ga and Ewe
- **PWA** — installable, offline-capable shell

## Tech stack

TypeScript · React 19 · Vite 7 · Tailwind CSS v4 · Hono · oRPC (type-safe RPC) · TanStack Query · Zod · unstorage (file or Supabase-backed)

## Brand

Ghana flag tricolour (red `#CE1126` · gold `#FCD116` · green `#006B3F`) on warm cream and deep ink-green surfaces, set in **Fraunces** (display) and **Inter** (body). The mark is a 3D "AC" monogram — a deep-green coin, gold A with the Black Star of Ghana, wrapped by a tricolour C ring.

## Local development

```bash
pnpm install
pnpm dev
```

No env vars are required for local development (falls back to file storage in `.storage/`). To use Supabase persistence, set `SUPABASE_URL` (bare base URL — no `/rest/v1/` suffix) and `SUPABASE_SERVICE_ROLE_KEY` (service-role "Secret" key, server-side only).

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for the Railway setup. Environment variables live in Railway (never in the repo).
