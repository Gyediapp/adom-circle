import { call, os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { addPoints, canModerate, memberKV, requireAdmin, requireMember } from "./members";
import { POINTS } from "../data/ranks";
import { notify } from "./notifications";

// ---------- Chatrooms ----------

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.string(),
  pinned: z.boolean(),
  createdAt: z.string(),
});

export type Room = z.output<typeof RoomSchema>;

export const roomKV = createKV<Room>("rooms");

// ---------- Messages ----------

export const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorRegion: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export type Message = z.output<typeof MessageSchema>;

export const messageKV = createKV<Message>("messages");

// ---------- Forum threads ----------

export const ThreadSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  title: z.string(),
  body: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  likes: z.number(),
  likedBy: z.array(z.string()),
  createdAt: z.string(),
});

export type Thread = z.output<typeof ThreadSchema>;

export const threadKV = createKV<Thread>("threads");

export const ReplySchema = z.object({
  id: z.string(),
  threadId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export type Reply = z.output<typeof ReplySchema>;

export const replyKV = createKV<Reply>("replies");

// ---------- Reports ----------

export const ReportSchema = z.object({
  id: z.string(),
  targetType: z.enum(["message", "thread", "reply", "member"]),
  targetLabel: z.string(),
  reason: z.string(),
  reporter: z.string(),
  status: z.enum(["open", "resolved", "dismissed"]),
  createdAt: z.string(),
});

export type Report = z.output<typeof ReportSchema>;

export const reportKV = createKV<Report>("reports");

// ---------- Helpers ----------

// ---------- Router ----------

const getRooms = os.handler(async () => {
  const rooms = await roomKV.getAllItems();
  const messages = await messageKV.getAllItems();
  return rooms
    .map((room) => ({
      ...room,
      messageCount: messages.filter((m) => m.roomId === room.id).length,
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));
});

const getMessages = os
  .input(z.object({ roomId: z.string() }))
  .handler(async ({ input }) => {
    const msgs = (await messageKV.getAllItems())
      .filter((m) => m.roomId === input.roomId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-60);
    return withAuthorInfo(msgs);
  });

// Attach live rank info (points + role) to any author-referencing item
async function withAuthorInfo<T extends { authorId: string }>(items: T[]): Promise<Array<T & { authorPoints: number; authorRole: string }>> {
  const cache = new Map<string, { points: number; role: string }>();
  const out: Array<T & { authorPoints: number; authorRole: string }> = [];
  for (const item of items) {
    let info = cache.get(item.authorId);
    if (!info) {
      const m = await memberKV.getItem(item.authorId);
      info = m ? { points: m.points, role: m.role } : { points: 0, role: "member" };
      cache.set(item.authorId, info);
    }
    out.push({ ...item, authorPoints: info.points, authorRole: info.role });
  }
  return out;
}

const getThreads = os.handler(async () => {
  const threads = await threadKV.getAllItems();
  const replies = await replyKV.getAllItems();
  const withCounts = threads
    .map((t) => ({
      ...t,
      replyCount: replies.filter((r) => r.threadId === t.id).length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return withAuthorInfo(withCounts);
});

const getThread = os.input(z.object({ threadId: z.string() })).handler(async ({ input }) => {
  const thread = await threadKV.getItem(input.threadId);
  if (!thread) throw new Error("Thread not found");
  const replies = (await replyKV.getAllItems())
    .filter((r) => r.threadId === input.threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { thread: (await withAuthorInfo([thread]))[0], replies: await withAuthorInfo(replies) };
});

export const community = {
  // rooms
  getRooms,
  createRoom: os
    .input(
      z.object({
        adminId: z.string(),
        name: z.string(),
        description: z.string(),
        icon: z.string(),
        color: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const room: Room = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        pinned: false,
        createdAt: new Date().toISOString(),
      };
      await roomKV.setItem(room.id, room);
      return room;
    }),
  togglePinRoom: os
    .input(z.object({ adminId: z.string(), roomId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const room = await roomKV.getItem(input.roomId);
      if (!room) throw new Error("Room not found");
      const updated = { ...room, pinned: !room.pinned };
      await roomKV.setItem(room.id, updated);
      return updated;
    }),
  removeRoom: os
    .input(z.object({ adminId: z.string(), roomId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await roomKV.removeItem(input.roomId);
      for (const m of await messageKV.getAllItems())
        if (m.roomId === input.roomId) await messageKV.removeItem(m.id);
      for (const t of await threadKV.getAllItems())
        if (t.roomId === input.roomId) await threadKV.removeItem(t.id);
    }),

  // messages
  getMessages,
  liveMessages: {
    byRoom: os.input(z.object({ roomId: z.string() })).handler(async function* ({ input, signal }) {
      yield call(getMessages, { roomId: input.roomId }, { signal });
      for await (const _ of messageKV.subscribe()) {
        yield call(getMessages, { roomId: input.roomId }, { signal });
      }
    }),
  },
  sendMessage: os
    .input(
      z.object({
        memberId: z.string(),
        roomId: z.string(),
        text: z.string().min(1).max(2000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const message: Message = {
        id: randomUUID(),
        roomId: input.roomId,
        authorId: member.id,
        authorName: member.name,
        authorRegion: member.region,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
      };
      await messageKV.setItem(message.id, message);
      await addPoints(member.id, POINTS.MESSAGE);
      return message;
    }),
  deleteMessage: os
    .input(z.object({ memberId: z.string(), messageId: z.string() }))
    .handler(async ({ input }) => {
      const message = await messageKV.getItem(input.messageId);
      if (!message) throw new Error("Message not found");
      const ok = await canModerate(input.memberId, message.roomId);
      if (!ok) throw new Error("You can only moderate rooms assigned to you");
      await messageKV.removeItem(input.messageId);
    }),

  // forum
  getThreads,
  getThread,
  liveThreads: {
    list: os.handler(async function* ({ signal }) {
      yield call(getThreads, {}, { signal });
      for await (const _ of threadKV.subscribe()) {
        yield call(getThreads, {}, { signal });
      }
    }),
  },
  createThread: os
    .input(
      z.object({
        memberId: z.string(),
        roomId: z.string(),
        title: z.string().min(3).max(200),
        body: z.string().min(3).max(5000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const thread: Thread = {
        id: randomUUID(),
        roomId: input.roomId,
        title: input.title.trim(),
        body: input.body.trim(),
        authorId: member.id,
        authorName: member.name,
        likes: 0,
        likedBy: [],
        createdAt: new Date().toISOString(),
      };
      await threadKV.setItem(thread.id, thread);
      await addPoints(member.id, POINTS.THREAD);
      return thread;
    }),
  replyToThread: os
    .input(
      z.object({
        memberId: z.string(),
        threadId: z.string(),
        text: z.string().min(1).max(3000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const reply: Reply = {
        id: randomUUID(),
        threadId: input.threadId,
        authorId: member.id,
        authorName: member.name,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
      };
      await replyKV.setItem(reply.id, reply);
      await addPoints(member.id, POINTS.REPLY);
      // Notify the thread author about the reply
      const thread = await threadKV.getItem(input.threadId);
      if (thread && thread.authorId !== member.id) {
        await notify(
          thread.authorId,
          "reply",
          `${member.name} replied to your discussion`,
          `Re: ${thread.title}`,
        ).catch(() => {});
      }
      return reply;
    }),
  likeThread: os
    .input(z.object({ memberId: z.string(), threadId: z.string() }))
    .handler(async ({ input }) => {
      const thread = await threadKV.getItem(input.threadId);
      if (!thread) throw new Error("Thread not found");
      const liked = thread.likedBy.includes(input.memberId);
      const updated: Thread = {
        ...thread,
        likedBy: liked
          ? thread.likedBy.filter((id) => id !== input.memberId)
          : [...thread.likedBy, input.memberId],
        likes: Math.max(0, thread.likes + (liked ? -1 : 1)),
      };
      await threadKV.setItem(thread.id, updated);
      if (!liked && thread.authorId !== input.memberId) {
        const { memberKV: mk } = await import("./members");
        const liker = await mk.getItem(input.memberId);
        await notify(
          thread.authorId,
          "like",
          `${liker?.name ?? "Someone"} liked your discussion`,
          thread.title,
        ).catch(() => {});
      }
      return updated;
    }),
  deleteThread: os
    .input(z.object({ memberId: z.string(), threadId: z.string() }))
    .handler(async ({ input }) => {
      const thread = await threadKV.getItem(input.threadId);
      if (!thread) throw new Error("Thread not found");
      const ok = await canModerate(input.memberId, thread.roomId);
      if (!ok) throw new Error("You can only moderate rooms assigned to you");
      await threadKV.removeItem(input.threadId);
      for (const r of await replyKV.getAllItems())
        if (r.threadId === input.threadId) await replyKV.removeItem(r.id);
    }),

  // reports
  getReports: os
    .input(z.object({ adminId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      return (await reportKV.getAllItems()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    }),
  createReport: os
    .input(
      z.object({
        reporter: z.string(),
        targetType: z.enum(["message", "thread", "reply", "member"]),
        targetLabel: z.string(),
        reason: z.string().min(3),
      }),
    )
    .handler(async ({ input }) => {
      const report: Report = {
        id: randomUUID(),
        ...input,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      await reportKV.setItem(report.id, report);
      return report;
    }),
  resolveReport: os
    .input(
      z.object({
        adminId: z.string(),
        reportId: z.string(),
        status: z.enum(["resolved", "dismissed"]),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const report = await reportKV.getItem(input.reportId);
      if (!report) throw new Error("Report not found");
      const updated = { ...report, status: input.status };
      await reportKV.setItem(report.id, updated);
      return updated;
    }),
};
