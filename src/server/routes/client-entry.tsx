/** @jsxImportSource hono/jsx */
import type { Context } from "hono";
import viteReact from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

import type { BlankEnv } from "hono/types";

const SITE_URL = "https://adomcircle.org";

// Route-aware SEO meta — crawlers get the right title/description per page
// even though the app is a client-rendered SPA.
const ROUTE_META: Record<string, { title: string; desc: string; noindex?: boolean }> = {
  "": {
    title: "Adom Circle — One Circle. One Ghana.",
    desc: "Ghana's circle of values, civic duty & progress. A civic and social community uniting Ghanaians at home and abroad under one Constitution.",
  },
  community: {
    title: "Community & Forum — Adom Circle",
    desc: "Join live chat rooms and forum discussions across Ghana — Youth & Education, Civic & Voting, Diaspora Corner and more.",
  },
  blog: {
    title: "Stories & Updates — Adom Circle Blog",
    desc: "News, stories, civic education and economic insights from the Adom Circle community — at home and in the diaspora.",
  },
  projects: {
    title: "Projects & Impact — Adom Circle",
    desc: "Giving back, measured. Volunteer projects across all 16 regions of Ghana — education, health, water, youth, environment and economy.",
  },
  events: {
    title: "Events & Activities — Adom Circle",
    desc: "Show up. Show Ghana. Meetups, workshops, fundraisers and volunteer days across Ghana and online — RSVP and earn points.",
  },
  civic: {
    title: "Civic & Voting — Adom Circle",
    desc: "Know the Constitution. Keep the peace. Non-partisan civic education and voter registration guidance for every Ghanaian.",
  },
  economy: {
    title: "Economy Hub — Adom Circle",
    desc: "Build, invest & buy Ghanaian. Entrepreneurship, responsible investment, remittances and local business support.",
  },
  about: {
    title: "About — Adom Circle",
    desc: "One Circle. One Ghana. Our mission, values and pillars — Constitution above all, religious freedom, social contribution and civic duty.",
  },
  admin: {
    title: "Admin Panel — Adom Circle",
    desc: "Adom Circle administration.",
    noindex: true,
  },
};

function metaFor(path: string) {
  const key = path.replace(/^\/+/, "").split("/")[0].split("?")[0].toLowerCase();
  return ROUTE_META[key] ?? ROUTE_META[""];
}

function jsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Adom Circle",
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    description:
      "Ghana's circle of values, civic duty & progress. Uniting Ghanaians at home and abroad under one Constitution, above every institution.",
    sameAs: [
      "https://facebook.com/adomcircle",
      "https://whatsapp.com/channel/adomcircle",
      "https://youtube.com/@adomcircle",
      "https://tiktok.com/@adomcircle",
    ],
  });
}

function extraHead(meta: { title: string; desc: string; noindex?: boolean }, path: string): string {
  const canonicalPath = path.replace(/\/+$/, "") || "/";
  const robots = meta.noindex ? '  <meta name="robots" content="noindex, nofollow" />\n' : "";
  return `  <link rel="canonical" href="${SITE_URL}${canonicalPath}" />\n${robots}  <script type="application/ld+json">${jsonLd()}</script>\n</head>`;
}

// In production, the client is a static build in ./dist — serve its index.html
// (the dev server below renders the page live via Vite's middleware).
export async function clientEntry(c: Context<BlankEnv>) {
  if (process.env.NODE_ENV === "production") {
    try {
      const meta = metaFor(c.req.path);
      let html = await readFile("./dist/index.html", "utf-8");
      html = html.replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`);
      html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${meta.desc}" />`,
      );
      html = html.replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
        `<meta property="og:title" content="${meta.title}" />`,
      );
      html = html.replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
        `<meta property="og:description" content="${meta.desc}" />`,
      );
      html = html.replace("</head>", extraHead(meta, c.req.path));
      return c.html(html);
    } catch {
      return c.text("Build not found — run `pnpm build` first.", 500);
    }
  }

  const meta = metaFor(c.req.path);
  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <meta name="theme-color" content="#0d1f17" />
        <meta name="description" content={meta.desc} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.desc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}${c.req.path === "/" ? "/" : c.req.path}`} />
        <meta property="og:image" content={`${SITE_URL}/icons/icon-512.png`} />
        <meta property="og:locale" content="en_GH" />
        {meta.noindex && <meta name="robots" content="noindex, nofollow" />}
        <link rel="canonical" href={`${SITE_URL}${c.req.path === "/" ? "/" : c.req.path}`} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <title>{meta.title}</title>
        <script
          dangerouslySetInnerHTML={{
            __html: viteReact.preambleCode.replace("__BASE__", "/"),
          }}
          type="module"
        />
        <script src="/src/client/main.tsx" type="module" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      </head>
      <body>
        <div id="root" />
      </body>
    </html>,
  );
}
