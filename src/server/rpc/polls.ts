import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { requireMember } from "./members";

// ---------- Polls (Civic & Voting room) ----------
// One vote per member per poll, enforced server-side (structural constraint).
// Polls are un-gameable: votes are stored as member-id lists, and voting
// twice is rejected.

const PollSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  createdBy: z.string(),
  createdAt: z.string(),
  closesAt: z.string().nullable(),
  votes: z.record(z.string(), z.array(z.string())), // optionIndex -> memberIds
  open: z.boolean(),
});

export type Poll = z.output<typeof PollSchema>;

export const pollKV = createKV<Poll>("polls");

function normalizePoll(p: Poll): Poll {
  return {
    ...p,
    options: p.options ?? [],
    votes: p.votes ?? {},
    closesAt: p.closesAt ?? null,
    open: p.open ?? true,
  };
}

// Count votes per option (public, no voter identities exposed)
function pollResults(p: Poll) {
  const counts = p.options.map((_, i) => (p.votes[String(i)] ?? []).length);
  const total = counts.reduce((a, b) => a + b, 0);
  return { counts, total };
}

export const polls = {
  list: os.input(z.object({ roomId: z.string() })).handler(async ({ input }) => {
    const all = await pollKV.getAllItems();
    return all
      .filter((p) => p.roomId === input.roomId)
      .map(normalizePoll)
      .map((p) => ({ ...p, ...pollResults(p) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  create: os
    .input(
      z.object({
        memberId: z.string(),
        roomId: z.string(),
        question: z.string().min(5).max(200),
        options: z.array(z.string().min(1).max(80)).min(2).max(6),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      // Guardrail: max one poll per member per day
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const recent = (await pollKV.getAllItems()).filter(
        (p) => p.createdBy === member.id && new Date(p.createdAt).getTime() >= dayStart.getTime(),
      );
      if (recent.length >= 1) {
        throw new Error("You've already created a poll today — one poll per day per member.");
      }
      const poll: Poll = {
        id: randomUUID(),
        roomId: input.roomId,
        question: input.question.trim(),
        options: input.options.map((o) => o.trim()),
        createdBy: input.memberId,
        createdAt: new Date().toISOString(),
        closesAt: null,
        votes: {},
        open: true,
      };
      await pollKV.setItem(poll.id, poll);
      return { ...poll, ...pollResults(poll) };
    }),

  vote: os
    .input(
      z.object({
        memberId: z.string(),
        pollId: z.string(),
        optionIndex: z.number().int().min(0),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await pollKV.getItem(input.pollId);
      if (!raw) throw new Error("Poll not found");
      const poll = normalizePoll(raw);
      if (!poll.open) throw new Error("This poll has closed");
      if (input.optionIndex >= poll.options.length) throw new Error("Invalid option");

      const votes = { ...poll.votes };
      // Remove any previous vote from this member (changeable vote)
      for (const opt of Object.keys(votes)) {
        votes[opt] = votes[opt].filter((id) => id !== member.id);
      }
      const list = votes[String(input.optionIndex)] ?? [];
      if (!list.includes(member.id)) list.push(member.id);
      votes[String(input.optionIndex)] = list;

      const updated = { ...poll, votes };
      await pollKV.setItem(updated.id, updated);
      return { ...updated, ...pollResults(updated) };
    }),

  close: os
    .input(z.object({ memberId: z.string(), pollId: z.string() }))
    .handler(async ({ input }) => {
      const { requireMember: reqMember } = await import("./members");
      const closer = await reqMember(input.memberId);
      const raw = await pollKV.getItem(input.pollId);
      if (!raw) throw new Error("Poll not found");
      const poll = normalizePoll(raw);
      const isCreator = poll.createdBy === closer.id;
      if (closer.role !== "admin" && closer.role !== "moderator" && !isCreator) {
        throw new Error("Only the poll creator, moderators and admins can close polls.");
      }
      const updated = { ...poll, open: false };
      await pollKV.setItem(updated.id, updated);
      return { ...updated, ...pollResults(updated) };
    }),

  remove: os
    .input(z.object({ adminId: z.string(), pollId: z.string() }))
    .handler(async ({ input }) => {
      const { requireAdmin } = await import("./members");
      await requireAdmin(input.adminId);
      await pollKV.removeItem(input.pollId);
    }),
};
