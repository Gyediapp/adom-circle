import { createStorage, StorageValue, WatchEvent } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Adom Circle storage layer — two interchangeable backends, same API.
//
//   - File storage (DEFAULT, unchanged): .storage/<collection>/<key>.json
//   - Supabase Postgres (opt-in): enabled when BOTH of these env vars are set:
//       SUPABASE_URL
//       SUPABASE_SERVICE_ROLE_KEY   (server-side only — never expose to the browser)
//
// The rest of the app only ever uses setItem / getItem / getItems / getKeys /
// removeItem / getAllItems / subscribe, so switching the backend requires no
// changes anywhere else. Rollback = remove the two env vars and redeploy.
//
// Schema (run once in Supabase SQL editor) is in supabase-schema.sql:
//   adom_storage(collection, key, value jsonb, updated_at)
//   adom_meta(collection, version)  +  bump_adom_version() — powers live updates
// ---------------------------------------------------------------------------

const STORAGE_PATH = process.env.STORAGE_DIR ?? "./.storage"; // gitignored

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const POLL_MS = Number(process.env.ADOM_POLL_MS ?? 2000); // live-update poll (supabase mode)
const KEEPALIVE_MS = 12 * 60 * 60 * 1000; // keeps the free Supabase project awake

let supabase: SupabaseClient | null = null;
let supabaseForced = false; // test hook only

/** Test hook — forces the Supabase backend (used by scripts/test-supabase-kv.ts). */
export function __forceSupabaseForTesting(force: boolean) {
  supabaseForced = force;
}

/** Test hook — injects a fake client (used by scripts/test-supabase-kv.ts). */
export function __setSupabaseClientForTesting(client: SupabaseClient | null) {
  supabase = client;
}

function usingSupabase(): boolean {
  return supabaseForced || Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Supabase storage enabled but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set",
      );
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabase;
}

// Free-tier Supabase projects pause after 7 days of inactivity. A trivial read
// every 12h (plus the live site's own traffic) keeps it awake. unref() so it
// never holds the process open.
let keepAliveStarted = false;
function startKeepAlive() {
  if (keepAliveStarted) return;
  keepAliveStarted = true;
  const t = setInterval(() => {
    void (async () => {
      try {
        await getSupabase().from("adom_meta").select("collection").limit(1);
      } catch {
        // ignore keep-alive failures
      }
    })();
  }, KEEPALIVE_MS);
  t.unref?.();
}

export interface KV<T extends StorageValue = StorageValue> {
  setItem(key: string, value: T): Promise<void>;
  getItem(key: string): Promise<T | null>;
  getItems(keys: string[]): Promise<{ key: string; value: T }[]>;
  getKeys(): Promise<string[]>;
  removeItem(key: string): Promise<void>;
  getAllItems(): Promise<T[]>;
  subscribe(): AsyncGenerator<{ event: WatchEvent; key: string }>;
}

export function createKV<T extends StorageValue>(name: string): KV<T> {
  if (usingSupabase()) {
    startKeepAlive();
    return createSupabaseKV<T>(name);
  }
  return createFileKV<T>(name);
}

// ---------------------------------------------------------------------------
// Backend 1 — filesystem (original behaviour, unchanged)
// ---------------------------------------------------------------------------

function createFileKV<T extends StorageValue>(name: string): KV<T> {
  const storagePath = `${STORAGE_PATH}/${name}`;

  // Ensure directory exists before creating storage
  if (!existsSync(storagePath)) {
    mkdir(storagePath, { recursive: true }).catch(() => {});
  }

  const storage = createStorage<T>({
    driver: fsDriver({ base: storagePath }),
  });

  // Async generator to play well with oRPC live queries
  async function* subscribe() {
    let resolve: (value: { event: WatchEvent; key: string }) => void;
    let promise = new Promise<{ event: WatchEvent; key: string }>(
      (r) => (resolve = r),
    );

    const unwatch = await storage.watch((event, key) => {
      resolve({ event, key });
      promise = new Promise<{ event: WatchEvent; key: string }>(
        (r) => (resolve = r),
      );
    });

    try {
      while (true) yield await promise;
    } finally {
      await unwatch();
    }
  }

  return {
    setItem: (key, value) => storage.setItem(key, value),
    getItem: (key) => storage.getItem(key) as Promise<T | null>,
    getItems: (keys) =>
      storage.getItems(keys) as Promise<{ key: string; value: T }[]>,
    getKeys: () => storage.getKeys() as Promise<string[]>,
    removeItem: (key) => storage.removeItem(key),
    getAllItems: async () => {
      const keys = await storage.getKeys();
      const values = await storage.getItems(keys);
      return values.map(({ value }) => value as T);
    },
    subscribe,
  };
}

// ---------------------------------------------------------------------------
// Backend 2 — Supabase Postgres (opt-in)
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createSupabaseKV<T extends StorageValue>(name: string): KV<T> {
  const collection = name;

  async function bumpVersion(): Promise<void> {
    const { error } = await getSupabase().rpc("bump_adom_version", {
      p_collection: collection,
    });
    if (error) {
      throw new Error(
        `storage version bump failed (${collection}): ${error.message} — did you run supabase-schema.sql?`,
      );
    }
  }

  async function getVersion(): Promise<number> {
    const { data, error } = await getSupabase()
      .from("adom_meta")
      .select("version")
      .eq("collection", collection)
      .maybeSingle();
    if (error) {
      throw new Error(`storage version read failed (${collection}): ${error.message}`);
    }
    return (data?.version as number) ?? 0;
  }

  async function getItem(key: string): Promise<T | null> {
    const { data, error } = await getSupabase()
      .from("adom_storage")
      .select("value")
      .eq("collection", collection)
      .eq("key", key)
      .maybeSingle();
    if (error) {
      throw new Error(`storage read failed (${collection}/${key}): ${error.message}`);
    }
    return (data?.value as T) ?? null;
  }

  async function getAllItems(): Promise<T[]> {
    const { data, error } = await getSupabase()
      .from("adom_storage")
      .select("value")
      .eq("collection", collection);
    if (error) {
      throw new Error(`storage list failed (${collection}): ${error.message}`);
    }
    return (data ?? []).map((r) => r.value as T);
  }

  async function getKeys(): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from("adom_storage")
      .select("key")
      .eq("collection", collection);
    if (error) {
      throw new Error(`storage keys failed (${collection}): ${error.message}`);
    }
    return (data ?? []).map((r) => r.key);
  }

  return {
    setItem: async (key, value) => {
      const { error } = await getSupabase()
        .from("adom_storage")
        .upsert({ collection, key, value }, { onConflict: "collection,key" });
      if (error) {
        throw new Error(`storage write failed (${collection}/${key}): ${error.message}`);
      }
      await bumpVersion();
    },

    getItem,

    getItems: async (keys) => {
      const out: { key: string; value: T }[] = [];
      for (const key of keys) {
        const value = await getItem(key);
        if (value !== null) out.push({ key, value });
      }
      return out;
    },

    getKeys,

    removeItem: async (key) => {
      const { error } = await getSupabase()
        .from("adom_storage")
        .delete()
        .eq("collection", collection)
        .eq("key", key);
      if (error) {
        throw new Error(`storage delete failed (${collection}/${key}): ${error.message}`);
      }
      await bumpVersion();
    },

    getAllItems,

    // Live updates: Postgres can't watch the filesystem, so we poll the
    // per-collection version counter. Every write/delete bumps it atomically
    // (bump_adom_version), so chat/forum updates surface within POLL_MS (~2s).
    subscribe: async function* () {
      let last = await getVersion();
      while (true) {
        await sleep(POLL_MS);
        let v: number;
        try {
          v = await getVersion();
        } catch {
          continue; // transient error — keep polling
        }
        if (v !== last) {
          last = v;
          yield { event: "update" as WatchEvent, key: collection };
        }
      }
    },
  };
}
