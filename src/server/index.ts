import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { rpcApp } from "./routes/rpc";
import { clientEntry } from "./routes/client-entry";

const app = new Hono();

app.route("/rpc", rpcApp);
app.use("/input/*", serveStatic({ root: "./" }));
app.use("/output/*", serveStatic({ root: "./" }));
app.use("/icons/*", serveStatic({ root: "./output" }));

const MANIFEST = {
  name: "Adom Circle — Ghana's Circle of Values, Civic Duty & Progress",
  short_name: "Adom Circle",
  description:
    "Uniting Ghanaians at home and abroad to contribute to peace, development and prosperity — under one Constitution, above every institution.",
  start_url: "/",
  display: "standalone",
  background_color: "#0d1f17",
  theme_color: "#0d1f17",
  categories: ["community", "civic", "social"],
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

app.get("/manifest.webmanifest", (c) => c.json(MANIFEST));

const SW = `
const CACHE = "adom-circle-v1";
const SHELL = "adom-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"];
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== SHELL).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Data-saver caching:
//  - App shell + static assets: cache-first (instant, zero data on repeat visits)
//  - Images: stale-while-revalidate (show cached, refresh quietly)
//  - Live content (RPC, output images served dynamically): network-first,
//    so chat/forum stays fresh and only the essentials hit the network.
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rpc")) return; // live data — never cache

  // App shell — cache first
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Images under /output — stale-while-revalidate (show cached instantly)
  if (url.pathname.startsWith("/output/") && IMAGE_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else (pages, html) — network first, cache fallback for offline
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((m) => m || caches.match("/")))
  );
});
`;

app.get("/sw.js", (c) =>
  c.text(SW, 200, {
    "Content-Type": "application/javascript",
    "Service-Worker-Allowed": "/",
  }),
);

// robots.txt — let search engines crawl everything and point at the sitemap
app.get("/robots.txt", (c) =>
  c.text(
    `User-agent: *\nAllow: /\n\nSitemap: https://adomcircle.org/sitemap.xml\n`,
    200,
    { "Content-Type": "text/plain" },
  ),
);

// sitemap.xml — the main public pages (the SPA also serves clean URLs like /community)
app.get("/sitemap.xml", (c) => {
  const pages = [
    { loc: "/", freq: "daily", prio: "1.0" },
    { loc: "/community", freq: "daily", prio: "0.9" },
    { loc: "/projects", freq: "weekly", prio: "0.8" },
    { loc: "/events", freq: "weekly", prio: "0.8" },
    { loc: "/civic", freq: "weekly", prio: "0.7" },
    { loc: "/economy", freq: "weekly", prio: "0.7" },
    { loc: "/about", freq: "monthly", prio: "0.6" },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>https://adomcircle.org${p.loc}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.prio}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
});

// RSS feed of recent community activity — lets anyone (or any tool/bot)
// subscribe to hot conversations without needing platform APIs.
app.get("/feed.xml", async (c) => {
  const { threadKV } = await import("./rpc/community");
  const { postKV } = await import("./rpc/site");
  const { eventKV } = await import("./rpc/events");
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const [threads, posts, events] = await Promise.all([
    threadKV.getAllItems(),
    postKV.getAllItems(),
    eventKV.getAllItems(),
  ]);

  const items = [
    ...threads.map((t) => ({
      title: t.title,
      link: "https://adomcircle.org/#/community",
      desc: `${t.body.slice(0, 280)}… — ${t.authorName}`,
      date: t.createdAt,
    })),
    ...posts.map((p) => ({
      title: p.title,
      link: "https://adomcircle.org/#/",
      desc: p.body.slice(0, 280),
      date: p.createdAt,
    })),
    ...events.map((e) => ({
      title: `Event: ${e.title}`,
      link: "https://adomcircle.org/#/events",
      desc: `${e.date.slice(0, 10)} · ${e.location} — ${e.description.slice(0, 220)}`,
      date: e.createdAt,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Adom Circle — One Circle. One Ghana.</title>
<link>https://adomcircle.org</link>
<description>Hot conversations, stories and events from Ghana's circle of values, civic duty &amp; progress.</description>
<atom:link href="https://adomcircle.org/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${i.link}</link>
<description>${esc(i.desc)}</description>
<pubDate>${new Date(i.date).toUTCString()}</pubDate>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return c.text(xml, 200, { "Content-Type": "application/rss+xml; charset=utf-8" });
});

// Production: serve the hashed client bundle from ./dist
if (process.env.NODE_ENV === "production") {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
}

app.get("/*", clientEntry);

export default app;

// Bootstrap the HTTP server in production (dev mode is handled by the Vite plugin)
if (process.env.NODE_ENV === "production" && process.env.ADOM_SKIP_SERVE !== "1") {
  const port = Number(process.env.PORT) || 3000;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Adom Circle running on http://0.0.0.0:${info.port}`);
  });
}

// Daily inspirational post — injects a scriptural/values quote into the
// Faith & Values room every morning (6:00 GMT). Runs in production only.
const INSPIRATIONS = [
  "“The fear of the Lord is the beginning of wisdom.” — Proverbs 9:10",
  "“Let us not become weary in doing good.” — Galatians 6:9",
  "“Blessed are the peacemakers.” — Matthew 5:9",
  "“In everything, do to others what you would have them do to you.” — Matthew 7:12",
  "“Where there is no vision, the people perish.” — Proverbs 29:18",
  "“Love your neighbour as yourself.” — Mark 12:31",
  "“Be strong and courageous. Do not be afraid.” — Joshua 1:9",
  "“Commit your work to the Lord, and your plans will be established.” — Proverbs 16:3",
  "“Let your light shine before others.” — Matthew 5:16",
  "“Ghana, our motherland — serve her with all your heart.” — Adom Circle",
];

const DAY_MS = 24 * 60 * 60 * 1000;

async function postDailyInspiration(): Promise<void> {
  try {
    const { messageKV, roomKV } = await import("./rpc/community");
    const rooms = await roomKV.getAllItems();
    const valuesRoom = rooms.find((r) => r.id === "room-values");
    if (!valuesRoom) return;
    const dayIndex = Math.floor(Date.now() / DAY_MS);
    const quote = INSPIRATIONS[dayIndex % INSPIRATIONS.length];
    const nowIso = new Date().toISOString();
    await messageKV.setItem(`inspiration-${dayIndex}`, {
      id: `inspiration-${dayIndex}`,
      roomId: "room-values",
      authorId: "adom-circle",
      authorName: "Adom Circle",
      authorRegion: "greater-accra",
      text: `🌅 Good morning, Circle. Today's reflection:\n\n${quote}\n\nMay it guide your day. 🇬🇭`,
      createdAt: nowIso,
      sentAt: nowIso,
      replyToId: null,
      reactions: {},
      savedBy: [],
      editedAt: null,
      deleted: false,
      mentions: [],
      audio: null,
      anonymous: false,
      pending: false,
      failed: false,
    });
    console.log("Daily inspiration posted");
  } catch (err) {
    console.error("Daily inspiration failed:", err);
  }
}

// Fire once shortly after boot, then daily. The timestamp key ensures one post
// per day even if the server restarts (idempotent).
if (process.env.NODE_ENV === "production") {
  const schedule = () => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(6, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      await postDailyInspiration();
      schedule();
    }, delay);
  };
  schedule();
}
