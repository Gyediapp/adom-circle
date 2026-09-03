import { os } from "@orpc/server";
import { z } from "zod";
import { requireAdmin } from "./members";
import { memberKV } from "./members";
import { postKV } from "./site";
import {
  messageKV,
  replyKV,
  reportKV,
  roomKV,
  threadKV,
} from "./community";
import { contributionKV, projectKV } from "./projects";
import {
  createKV,
  backendName,
  createFileKVForced,
  readSupabaseCollectionRaw,
} from "../lib/create-kv";

// Every storage collection in the app (each maps to a createKV(name) store).
// Must stay in sync if new collections are added.
const COLLECTIONS = [
  "members",
  "sessions",
  "auth-attempts",
  "rooms",
  "messages",
  "message-audio",
  "threads",
  "replies",
  "reports",
  "settings",
  "posts",
  "suggestions",
  "projects",
  "contributions",
  "tasks",
  "notifications",
  "events",
  "ads",
  "emails",
  "dm-convos",
  "dm-messages",
] as const;

export const admin = {
  overview: os
    .input(z.object({ adminId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);

      const members = await memberKV.getAllItems();
      const posts = await postKV.getAllItems();
      const messages = await messageKV.getAllItems();
      const replies = await replyKV.getAllItems();
      const reports = await reportKV.getAllItems();
      const rooms = await roomKV.getAllItems();
      const threads = await threadKV.getAllItems();
      const projects = await projectKV.getAllItems();
      const contributions = await contributionKV.getAllItems();

      // Popular themes from projects
      const themeCounts: Record<string, number> = {};
      for (const p of projects) themeCounts[p.theme] = (themeCounts[p.theme] ?? 0) + 1;

      // Region participation (members per region)
      const regionCounts: Record<string, number> = {};
      for (const m of members) regionCounts[m.region] = (regionCounts[m.region] ?? 0) + 1;

      // Most active rooms
      const roomActivity = rooms
        .map((r) => ({
          name: r.name,
          icon: r.icon,
          messages: messages.filter((m) => m.roomId === r.id).length,
          threads: threads.filter((t) => t.roomId === r.id).length,
        }))
        .sort((a, b) => b.messages + b.threads - (a.messages + a.threads));

      const diaspora = members.filter((m) => m.diasporaCountry).length;
      const pledged = members.filter((m) => m.pledgeVote).length;
      const totalHours = projects.reduce((s, p) => s + p.hours, 0) +
        contributions.reduce((s, c) => s + c.hours, 0);

      return {
        emailLive: Boolean(process.env.RESEND_API_KEY),
        aiModerationLive: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY),
        counts: {
          members: members.length,
          posts: posts.length,
          messages: messages.length,
          threads: threads.length,
          replies: replies.length,
          reports: reports.length,
          openReports: reports.filter((r) => r.status === "open").length,
          rooms: rooms.length,
          projects: projects.length,
          contributions: contributions.length,
          diaspora,
          pledged,
          totalHours,
        },
        themes: Object.entries(themeCounts)
          .map(([theme, count]) => ({ theme, count }))
          .sort((a, b) => b.count - a.count),
        regions: Object.entries(regionCounts)
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count),
        roomActivity,
        topMembers: members
          .slice()
          .sort((a, b) => b.points - a.points)
          .slice(0, 6)
          .map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            points: m.points,
            region: m.region,
            badges: m.badges.slice(0, 3),
          })),
        recentMessages: messages
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 8),
        recentThreads: threads
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 8),
      };
    }),

  // Current storage backend + per-collection sizes (Admin → Overview)
  storageStatus: os
    .input(z.object({ adminId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const backend = backendName();
      const collections: Array<{ name: string; count: number }> = [];
      for (const name of COLLECTIONS) {
        const items = await createKV(name).getAllItems();
        collections.push({ name, count: items.length });
      }
      return {
        backend,
        storagePath: process.env.STORAGE_DIR ?? "./.storage",
        collections,
        canMigrate: backend === "supabase",
      };
    }),

  // One-time migration: copy every collection from Supabase into the local
  // file store (the Railway volume). Reads Supabase only — never deletes.
  // After this succeeds, remove SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and
  // redeploy; the app then runs entirely on the volume with zero egress.
  migrateStorageToFile: os
    .input(z.object({ adminId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      if (backendName() !== "supabase") {
        throw new Error("The app is already on file storage — nothing to migrate.");
      }
      if (migrationRunning) {
        throw new Error("A migration is already running — please wait.");
      }
      migrationRunning = true;
      try {
        const results: Record<string, number> = {};
        let total = 0;
        for (const name of COLLECTIONS) {
          const rows = await readSupabaseCollectionRaw(name);
          const dest = createFileKVForced(name);
          for (const row of rows) {
            await dest.setItem(row.key, row.value as never);
          }
          results[name] = rows.length;
          total += rows.length;
        }
        return { backend: "file", collections: results, total };
      } finally {
        migrationRunning = false;
      }
    }),
};

let migrationRunning = false;
