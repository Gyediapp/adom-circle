/** @jsxImportSource hono/jsx */
import type { Context } from "hono";
import viteReact from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

import type { BlankEnv } from "hono/types";

// In production, the client is a static build in ./dist — serve its index.html
// (the dev server below renders the page live via Vite's middleware).
export async function clientEntry(c: Context<BlankEnv>) {
  if (process.env.NODE_ENV === "production") {
    try {
      const html = await readFile("./dist/index.html", "utf-8");
      return c.html(html);
    } catch {
      return c.text("Build not found — run `pnpm build` first.", 500);
    }
  }

  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <meta name="theme-color" content="#0d1f17" />
        <meta
          name="description"
          content="Adom Circle unites Ghanaians at home and abroad to contribute to peace, development and prosperity — under one Constitution, above every institution."
        />
        <meta property="og:title" content="Adom Circle — One Circle. One Ghana." />
        <meta
          property="og:description"
          content="Ghana's circle of values, civic duty & progress. Join the community, track contributions, and help keep Ghana peaceful and prosperous."
        />
        <meta property="og:type" content="website" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <title>Adom Circle — One Circle. One Ghana.</title>
        <script
          dangerouslySetInnerHTML={{
            __html: viteReact.preambleCode.replace("__BASE__", "/"),
          }}
          type="module"
        />
        <script src="/src/client/main.tsx" type="module" />
      </head>
      <body>
        <div id="root" />
      </body>
    </html>,
  );
}
