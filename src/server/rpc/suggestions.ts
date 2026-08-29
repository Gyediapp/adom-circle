import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { requireMember, requireAdmin } from "./members";

// ---------- Voice for Ghana ----------
// Members post one-sentence suggestions for MPs/representatives — "what should
// we put forward, leaving no one behind." Admins review, approve & feature them.

const SuggestionSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  text: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  featured: z.boolean(),
  upvotes: z.array(z.string()),
  createdAt: z.string(),
});

export type Suggestion = z.output<typeof SuggestionSchema>;

export const suggestionKV = createKV<Suggestion>("suggestions");

function normalizeSuggestion(s: Suggestion): Suggestion {
  return {
    ...s,
    status: s.status ?? "pending",
    featured: s.featured ?? false,
    upvotes: s.upvotes ?? [],
  };
}

export const suggestions = {
  // Public: approved + featured ones (the wall)
  list: os.handler(async () => {
    const all = await suggestionKV.getAllItems();
    return all
      .filter((s) => s.status === "approved")
      .map(normalizeSuggestion)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.upvotes.length - a.upvotes.length)
      .slice(0, 50);
  }),

  // My suggestions (for the author)
  mine: os.input(z.object({ memberId: z.string() })).handler(async ({ input }) => {
    await requireMember(input.memberId);
    return (await suggestionKV.getAllItems())
      .filter((s) => s.authorId === input.memberId)
      .map(normalizeSuggestion)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  // Submit a suggestion (any member, 1/day)
  submit: os
    .input(z.object({ memberId: z.string(), text: z.string().min(10).max(280) }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const recent = (await suggestionKV.getAllItems()).filter(
        (s) => s.authorId === member.id && new Date(s.createdAt).getTime() >= dayStart.getTime(),
      );
      if (recent.length >= 1) {
        throw new Error("You've already sent a suggestion today — one per day.");
      }
      const s: Suggestion = {
        id: randomUUID(),
        authorId: member.id,
        authorName: member.name,
        text: input.text.trim(),
        status: "pending",
        featured: false,
        upvotes: [],
        createdAt: new Date().toISOString(),
      };
      await suggestionKV.setItem(s.id, s);
      return normalizeSuggestion(s);
    }),

  upvote: os
    .input(z.object({ memberId: z.string(), suggestionId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await suggestionKV.getItem(input.suggestionId);
      if (!raw) throw new Error("Suggestion not found");
      const s = normalizeSuggestion(raw);
      const upvoted = s.upvotes.includes(member.id);
      const updated = {
        ...s,
        upvotes: upvoted
          ? s.upvotes.filter((id) => id !== member.id)
          : [...s.upvotes, member.id],
      };
      await suggestionKV.setItem(updated.id, updated);
      return normalizeSuggestion(updated);
    }),

  // Admin: review all + approve/reject/feature/delete
  adminList: os.input(z.object({ adminId: z.string() })).handler(async ({ input }) => {
    await requireAdmin(input.adminId);
    return (await suggestionKV.getAllItems())
      .map(normalizeSuggestion)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  moderate: os
    .input(
      z.object({
        adminId: z.string(),
        suggestionId: z.string(),
        status: z.enum(["pending", "approved", "rejected"]),
        featured: z.boolean().optional(),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const raw = await suggestionKV.getItem(input.suggestionId);
      if (!raw) throw new Error("Suggestion not found");
      const updated: Suggestion = {
        ...normalizeSuggestion(raw),
        status: input.status,
        featured: input.featured ?? raw.featured ?? false,
      };
      await suggestionKV.setItem(updated.id, updated);
      return normalizeSuggestion(updated);
    }),

  remove: os
    .input(z.object({ adminId: z.string(), suggestionId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await suggestionKV.removeItem(input.suggestionId);
    }),
};
