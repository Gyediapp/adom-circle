import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { memberKV, requireMember } from "./members";
import { DM_MIN_POINTS } from "../../shared/constants";

// ---------- Private messages (DMs) ----------
// Unlocked by activity: members need a little contribution history before they
// can message others, which keeps the community safe from spam.

const DMConvoSchema = z.object({
  id: z.string(),
  memberIds: z.array(z.string()), // exactly 2
  lastText: z.string(),
  lastAt: z.string(),
  unread: z.record(z.string(), z.number()),
  createdAt: z.string(),
});
type DMConvo = z.output<typeof DMConvoSchema>;

const DMMessageSchema = z.object({
  id: z.string(),
  convoId: z.string(),
  fromId: z.string(),
  text: z.string(),
  createdAt: z.string(),
});
type DMMessage = z.output<typeof DMMessageSchema>;

export const dmConvoKV = createKV<DMConvo>("dm-convos");
export const dmMessageKV = createKV<DMMessage>("dm-messages");

function convoKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export const dms = {
  start: os
    .input(z.object({ fromId: z.string(), toId: z.string() }))
    .handler(async ({ input }) => {
      const from = await requireMember(input.fromId);
      if (from.points < DM_MIN_POINTS) {
        throw new Error(
          `Private messaging unlocks at ${DM_MIN_POINTS} points — keep contributing!`,
        );
      }
      const to = await memberKV.getItem(input.toId);
      if (!to) throw new Error("Member not found");
      if (from.id === to.id) throw new Error("You can't message yourself");

      const id = convoKey(from.id, to.id);
      let convo = await dmConvoKV.getItem(id);
      if (!convo) {
        convo = {
          id,
          memberIds: [from.id, to.id],
          lastText: "",
          lastAt: new Date().toISOString(),
          unread: { [from.id]: 0, [to.id]: 0 },
          createdAt: new Date().toISOString(),
        };
        await dmConvoKV.setItem(id, convo);
      }
      return convo;
    }),

  list: os.input(z.object({ memberId: z.string() })).handler(async ({ input }) => {
    const me = await requireMember(input.memberId);
    const convos = (await dmConvoKV.getAllItems())
      .filter((c) => c.memberIds.includes(me.id))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    const out: Array<
      DMConvo & {
        other: { id: string; name: string; region: string; points: number; role: string; avatarImage: string | null } | null;
        unreadForMe: number;
      }
    > = [];
    for (const c of convos) {
      const otherId = c.memberIds.find((id) => id !== me.id);
      const other = otherId ? await memberKV.getItem(otherId) : null;
      out.push({
        ...c,
        other: other
          ? {
              id: other.id,
              name: other.name,
              region: other.region,
              points: other.points,
              role: other.role,
              avatarImage: other.avatarImage ?? null,
            }
          : null,
        unreadForMe: c.unread[me.id] ?? 0,
      });
    }
    return out;
  }),

  messages: os
    .input(z.object({ memberId: z.string(), convoId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      const convo = await dmConvoKV.getItem(input.convoId);
      if (!convo || !convo.memberIds.includes(me.id)) {
        throw new Error("Conversation not found");
      }
      // Mark this member's unread as seen
      if ((convo.unread[me.id] ?? 0) > 0) {
        const updated = { ...convo, unread: { ...convo.unread, [me.id]: 0 } };
        await dmConvoKV.setItem(convo.id, updated);
      }
      return (await dmMessageKV.getAllItems())
        .filter((m) => m.convoId === input.convoId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-100);
    }),

  send: os
    .input(
      z.object({
        fromId: z.string(),
        convoId: z.string(),
        text: z.string().min(1).max(2000),
      }),
    )
    .handler(async ({ input }) => {
      const from = await requireMember(input.fromId);
      const convo = await dmConvoKV.getItem(input.convoId);
      if (!convo || !convo.memberIds.includes(from.id)) {
        throw new Error("Conversation not found");
      }
      const msg: DMMessage = {
        id: randomUUID(),
        convoId: convo.id,
        fromId: from.id,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
      };
      await dmMessageKV.setItem(msg.id, msg);
      const toId = convo.memberIds.find((id) => id !== from.id)!;
      const updated: DMConvo = {
        ...convo,
        lastText: msg.text,
        lastAt: msg.createdAt,
        unread: { ...convo.unread, [toId]: (convo.unread[toId] ?? 0) + 1 },
      };
      await dmConvoKV.setItem(convo.id, updated);
      return msg;
    }),

  unreadTotal: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      const convos = await dmConvoKV.getAllItems();
      return convos
        .filter((c) => c.memberIds.includes(input.memberId))
        .reduce((sum, c) => sum + (c.unread[input.memberId] ?? 0), 0);
    }),
};
