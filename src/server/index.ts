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
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rpc")) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(request).then((m) => m || caches.match("/"))
      )
  );
});
`;

app.get("/sw.js", (c) =>
  c.text(SW, 200, {
    "Content-Type": "application/javascript",
    "Service-Worker-Allowed": "/",
  }),
);

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
