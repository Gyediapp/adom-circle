import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { router } from "@/server/rpc";

// API base: defaults to same origin (single-server deploy on Railway).
// Set VITE_API_URL at build time if you later split the frontend (Vercel)
// from the API (Railway).
const apiBase =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ??
  window.location.origin;

// Attach the session token to every RPC call so the server can authenticate us
const link = new RPCLink({
  url: `${apiBase}/rpc`,
  headers: () => {
    const token = localStorage.getItem("adom_token");
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

export const rpcClient: RouterClient<typeof router> = createORPCClient(link);

export const queryClient = createTanstackQueryUtils(rpcClient);
