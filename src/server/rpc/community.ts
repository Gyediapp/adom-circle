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
  allowAnonymous: z.boolean(),
  features: z.array(z.enum(["polls", "kanban", "anonymous"])),
  createdAt: z.string(),
});

export type Room = z.output<typeof RoomSchema>;

export const roomKV = createKV<Room>("rooms");

// Live presence: how many people are currently viewing each room (chat view).
// Counted by active liveMessages.byRoom subscriptions — the client subscribes
// only to the room it's viewing, so this is real "in the room right now" data.
// In-memory only: fine for a single Railway replica; resets on restart.
const roomViewers = new Map<string, Set<string>>();

// Existing rooms predate these fields — derive sensible defaults from the
// room id so the flagship rooms work without a reseed.
function normalizeRoom(r: Room): Room {
  const features = r.features ?? [];
  const idFeatures: Room["features"] = [];
  if (r.id === "room-civic") idFeatures.push("polls");
  if (r.id === "room-projects") idFeatures.push("kanban");
  if (r.id === "room-health") idFeatures.push("anonymous");
  return {
    ...r,
    allowAnonymous: r.allowAnonymous ?? r.id === "room-health",
    features: features.length > 0 ? features : idFeatures,
  };
}

// ---------- Messages ----------

export const REACTION_TYPES = ["like", "love", "smile", "angry", "undecided"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorRegion: z.string(),
  text: z.string(),
  createdAt: z.string(),
  sentAt: z.string(),
  replyToId: z.string().nullable(),
  reactions: z.record(z.string(), z.array(z.string())),
  savedBy: z.array(z.string()),
  editedAt: z.string().nullable(),
  deleted: z.boolean(),
  mentions: z.array(z.object({ id: z.string(), name: z.string() })),
  audio: z.string().nullable(),
  hasAudio: z.boolean().optional(),
  anonymous: z.boolean(),
  pending: z.boolean(),
  failed: z.boolean(),
});

export type Message = z.output<typeof MessageSchema>;

export const messageKV = createKV<Message>("messages");

// Voice messages are stored OUTSIDE the message rows (keyed by message id) so
// that listing/fetching chat never moves the audio bytes. Clients fetch one
// voice note on demand via getMessageAudio — this is the single biggest
// bandwidth/egress saver for Supabase-backed deployments.
export const messageAudioKV = createKV<string>("message-audio");

// Legacy messages (before this change) carried their audio inline. Move those
// blobs into the separate collection once, then keep the rows slim.
let audioMigrationStarted = false;
function startAudioMigration() {
  if (audioMigrationStarted) return;
  audioMigrationStarted = true;
  void (async () => {
    try {
      let moved = 0;
      for (const raw of await messageKV.getAllItems()) {
        // Check the RAW record: legacy rows have inline `audio` and NO
        // `hasAudio` field. (normalizeMessage() can't be used here — it
        // derives hasAudio=true from the inline audio, which would make
        // this condition never true.)
        if (raw.audio && !raw.hasAudio) {
          await messageAudioKV.setItem(raw.id, raw.audio);
          await messageKV.setItem(raw.id, { ...raw, audio: null, hasAudio: true });
          moved++;
        }
      }
      if (moved > 0) console.log(`[audio] moved ${moved} legacy voice message(s) to separate storage`);
    } catch (err) {
      // Non-fatal — getMessageAudio lazily migrates inline audio on first play.
      console.error("[audio] legacy voice migration failed (lazy fallback active):", err);
    }
  })();
}

// Public shape of a message: the payload is a tiny placeholder + flag, never
// the audio blob itself.
function toPublicMessage(m: Message): Message & { hasAudio: boolean } {
  return { ...m, audio: null, hasAudio: m.hasAudio ?? Boolean(m.audio) };
}

// Old stored messages predate reactions/replies — fill safe defaults on read
function normalizeMessage(m: Message): Message {
  return {
    ...m,
    replyToId: m.replyToId ?? null,
    reactions: m.reactions ?? {},
    savedBy: m.savedBy ?? [],
    editedAt: m.editedAt ?? null,
    deleted: m.deleted ?? false,
    mentions: m.mentions ?? [],
    audio: m.audio ?? null,
    hasAudio: m.hasAudio ?? Boolean(m.audio),
    anonymous: m.anonymous ?? false,
    sentAt: m.sentAt ?? m.createdAt,
    pending: m.pending ?? false,
    failed: m.failed ?? false,
  };
}

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
  editedAt: z.string().nullable(),
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
  editedAt: z.string().nullable(),
  deleted: z.boolean(),
});

export type Reply = z.output<typeof ReplySchema>;

export const replyKV = createKV<Reply>("replies");

function normalizeReply(r: Reply): Reply {
  return {
    ...r,
    editedAt: r.editedAt ?? null,
    deleted: r.deleted ?? false,
  };
}

function normalizeThread(t: Thread): Thread {
  return { ...t, editedAt: t.editedAt ?? null };
}

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
    .map((r) => ({
      ...normalizeRoom(r),
      messageCount: messages.filter((m) => m.roomId === r.id).length,
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));
});

const getMessages = os
  .input(z.object({ roomId: z.string() }))
  .handler(async ({ input }) => {
    const msgs = (await messageKV.getAllItems())
      .filter((m) => m.roomId === input.roomId)
      .map(normalizeMessage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-80)
      .map(toPublicMessage);
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
    .map(normalizeThread)
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
    .map(normalizeReply)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { thread: (await withAuthorInfo([normalizeThread(thread)]))[0], replies: await withAuthorInfo(replies) };
});

// Move legacy inline audio into the separate collection (once per boot until done)
startAudioMigration();

export const community = {
  // rooms
  getRooms,  createRoom: os
    .input(
      z.object({
        adminId: z.string(),
        name: z.string(),
        description: z.string(),
        icon: z.string(),
        color: z.string(),
        allowAnonymous: z.boolean().optional(),
        features: z.array(z.enum(["polls", "kanban", "anonymous"])).optional(),
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
        allowAnonymous: input.allowAnonymous ?? Boolean(input.features?.includes("anonymous")),
        features: input.features ?? [],
        createdAt: new Date().toISOString(),
      };
      await roomKV.setItem(room.id, room);
      return room;
    }),
  toggleAnonymous: os
    .input(z.object({ adminId: z.string(), roomId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const room = await roomKV.getItem(input.roomId);
      if (!room) throw new Error("Room not found");
      const updated = { ...normalizeRoom(room), allowAnonymous: !room.allowAnonymous };
      await roomKV.setItem(updated.id, updated);
      return updated;
    }),
  setRoomFeature: os
    .input(
      z.object({
        adminId: z.string(),
        roomId: z.string(),
        feature: z.enum(["polls", "kanban", "anonymous"]),
        enabled: z.boolean(),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const room = await roomKV.getItem(input.roomId);
      if (!room) throw new Error("Room not found");
      const normalized = normalizeRoom(room);
      const features = input.enabled
        ? Array.from(new Set([...normalized.features, input.feature]))
        : normalized.features.filter((f) => f !== input.feature);
      const updated: Room = {
        ...normalized,
        features,
        allowAnonymous: input.feature === "anonymous" ? input.enabled : normalized.allowAnonymous,
      };
      await roomKV.setItem(updated.id, updated);
      return updated;
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
  updateRoom: os
    .input(
      z.object({
        adminId: z.string(),
        roomId: z.string(),
        name: z.string(),
        description: z.string(),
        icon: z.string(),
        color: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const room = await roomKV.getItem(input.roomId);
      if (!room) throw new Error("Room not found");
      const updated: Room = {
        ...normalizeRoom(room),
        name: input.name.trim() || room.name,
        description: input.description.trim() || room.description,
        icon: input.icon.trim() || room.icon,
        color: input.color?.trim() || room.color,
      };
      await roomKV.setItem(updated.id, updated);
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
      const viewerId = randomUUID();
      let viewers = roomViewers.get(input.roomId);
      if (!viewers) {
        viewers = new Set();
        roomViewers.set(input.roomId, viewers);
      }
      viewers.add(viewerId);
      try {
        yield call(getMessages, { roomId: input.roomId }, { signal });
        for await (const _ of messageKV.subscribe()) {
          yield call(getMessages, { roomId: input.roomId }, { signal });
        }
      } finally {
        viewers.delete(viewerId);
        if (viewers.size === 0) roomViewers.delete(input.roomId);
      }
    }),
  },
  // How many people are in each room right now (public, lightweight).
  roomPresence: os.handler(async () => {
    const out: Record<string, number> = {};
    for (const [roomId, viewers] of roomViewers) {
      if (viewers.size > 0) out[roomId] = viewers.size;
    }
    return out;
  }),
  sendMessage: os
    .input(
      z
        .object({
          memberId: z.string(),
          roomId: z.string(),
          text: z.string().max(2000),
          replyToId: z.string().nullable().optional(),
          mentionIds: z.array(z.string()).max(10).optional(),
          audio: z.string().nullable().optional(),
          anonymous: z.boolean().optional(),
          confirmPending: z.string().optional(),
        })
        .superRefine((v, ctx) => {
          // Text or audio required — a voice-only message is allowed with empty text
          if (!v.text.trim() && !v.audio) {
            ctx.addIssue({
              code: "custom",
              message: "Message text is required (or attach a voice message)",
              path: ["text"],
            });
          }
        }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      if (input.audio && (!input.audio.startsWith("data:audio/") || input.audio.length > 600_000)) {
        throw new Error("Voice message is too large (max ~60 seconds)");
      }
      // Content moderation — free local filter always on; AI when configured
      const { localFilter, aiModerate } = await import("../lib/moderation");
      const local = localFilter(input.text);
      let mod = local;
      if (local.flagged) {
        const ai = await aiModerate(input.text);
        if (ai) mod = ai;
      }
      if (mod.blocked) {
        throw new Error("This message was blocked by our content guidelines.");
      }
      // Log flagged messages for admin review
      if (mod.flagged) {
        const { reportKV } = await import("./community");
        const reportId = randomUUID();
        await reportKV.setItem(reportId, {
          id: reportId,
          targetType: "message",
          targetLabel: `${member.name}: "${input.text.trim().slice(0, 60)}…"`,
          reason: `auto-flag: ${mod.reasons.join(", ")}`,
          reporter: "auto-moderation",
          status: "open",
          createdAt: new Date().toISOString(),
        });
      }
      // Anonymous posting — only allowed in rooms that opt in (Health & Welfare)
      const room = await roomKV.getItem(input.roomId);
      const roomNorm = room ? normalizeRoom(room) : null;
      const anonymous = Boolean(input.anonymous) && Boolean(roomNorm?.allowAnonymous);
      // Resolve @mentions to member names and fan out notifications
      const mentions: { id: string; name: string }[] = [];
      for (const id of [...new Set(input.mentionIds ?? [])]) {
        if (id === member.id) continue;
        const target = await memberKV.getItem(id);
        if (target && mentions.length < 10) {
          mentions.push({ id: target.id, name: target.name });
          await notify(
            target.id,
            "system",
            `${member.name} mentioned you`,
            `In #${roomNorm?.name ?? "chat"}: ${input.text.trim().slice(0, 90)}`,
          ).catch(() => {});
        }
      }
      const nowIso = new Date().toISOString();
      const message: Message = {
        id: randomUUID(),
        roomId: input.roomId,
        authorId: anonymous ? "anonymous" : member.id,
        authorName: anonymous ? "Anonymous" : member.name,
        authorRegion: anonymous ? "" : member.region,
        text: input.text.trim(),
        createdAt: nowIso,
        sentAt: nowIso,
        replyToId: input.replyToId ?? null,
        reactions: {},
        savedBy: [],
        editedAt: null,
        deleted: false,
        mentions,
        audio: null,
        hasAudio: Boolean(input.audio),
        anonymous,
        pending: false,
        failed: false,
      };
      // Persist the audio blob separately first so a failed message write never
      // leaves a hasAudio flag pointing at a missing blob (upsert is safe).
      if (input.audio) await messageAudioKV.setItem(message.id, input.audio);
      await messageKV.setItem(message.id, message);
      // If this confirms an optimistically-pending message, drop the pending copy
      if (input.confirmPending && input.confirmPending !== message.id) {
        await messageKV.removeItem(input.confirmPending).catch(() => {});
      }
      await addPoints(member.id, POINTS.MESSAGE);
      return toPublicMessage(message);
    }),
  addReaction: os
    .input(
      z.object({
        memberId: z.string(),
        messageId: z.string(),
        type: z.enum(REACTION_TYPES),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await messageKV.getItem(input.messageId);
      if (!raw) throw new Error("Message not found");
      const message = normalizeMessage(raw);
      const reactions = { ...message.reactions };
      const current = reactions[input.type] ?? [];
      const reacted = current.includes(member.id);
      reactions[input.type] = reacted
        ? current.filter((id) => id !== member.id)
        : [...current, member.id];
      if (reactions[input.type].length === 0) delete reactions[input.type];
      const updated = { ...message, reactions };
      await messageKV.setItem(updated.id, updated);
      return toPublicMessage(updated);
    }),
  toggleSaveMessage: os
    .input(z.object({ memberId: z.string(), messageId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await messageKV.getItem(input.messageId);
      if (!raw) throw new Error("Message not found");
      const message = normalizeMessage(raw);
      const saved = message.savedBy.includes(member.id);
      const updatedMessage = {
        ...message,
        savedBy: saved
          ? message.savedBy.filter((id) => id !== member.id)
          : [...message.savedBy, member.id],
      };
      await messageKV.setItem(updatedMessage.id, updatedMessage);
      const savedMessages = member.savedMessages ?? [];
      const updatedMember = {
        ...member,
        savedMessages: saved
          ? savedMessages.filter((id) => id !== message.id)
          : [...savedMessages, message.id],
      };
      await memberKV.setItem(member.id, updatedMember);
      return updatedMessage;
    }),
  getSavedMessages: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      await requireMember(input.memberId);
      const member = await memberKV.getItem(input.memberId);
      const ids = member?.savedMessages ?? [];
      if (ids.length === 0) return [];
      const all = (await messageKV.getAllItems()).map(normalizeMessage);
      return withAuthorInfo(all.filter((m) => ids.includes(m.id)).map(toPublicMessage));
    }),
  // Fetch a single voice message's audio on demand (only when the user taps
  // play). Message lists carry just a hasAudio flag — never the payload.
  getMessageAudio: os
    .input(z.object({ messageId: z.string() }))
    .handler(async ({ input }) => {
      const raw = await messageKV.getItem(input.messageId);
      if (!raw) return { audio: null };
      const m = normalizeMessage(raw);
      if (m.deleted) return { audio: null };
      // New messages keep their audio in the separate store.
      if (m.hasAudio) {
        const stored = await messageAudioKV.getItem(m.id);
        if (stored) return { audio: stored };
        // hasAudio is set but no blob in the store — either a legacy message
        // the boot migration hasn't reached yet, or the blob is missing.
        // Fall back to inline audio if present (legacy), else report missing.
        if (m.audio) {
          // Opportunistic lazy migration: persist it now so the next play is
          // a cheap store read, then slim the row.
          try {
            await messageAudioKV.setItem(m.id, m.audio);
            await messageKV.setItem(m.id, { ...m, audio: null, hasAudio: true });
          } catch {
            // non-fatal — the inline copy still plays below
          }
          return { audio: m.audio };
        }
        return { audio: null };
      }
      // No flag and no inline audio — nothing to play.
      return { audio: m.audio ?? null };
    }),
  editMessage: os
    .input(
      z.object({
        memberId: z.string(),
        messageId: z.string(),
        text: z.string().min(1).max(2000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await messageKV.getItem(input.messageId);
      if (!raw) throw new Error("Message not found");
      const message = normalizeMessage(raw);
      if (message.deleted) throw new Error("This message was deleted");
      const canEdit =
        message.authorId === member.id || (await canModerate(member.id, message.roomId));
      if (!canEdit) throw new Error("You can only edit your own messages");
      const updated = {
        ...message,
        text: input.text.trim(),
        editedAt: new Date().toISOString(),
      };
      await messageKV.setItem(updated.id, updated);
      return toPublicMessage(updated);
    }),
  deleteMessage: os
    .input(z.object({ memberId: z.string(), messageId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await messageKV.getItem(input.messageId);
      if (!raw) throw new Error("Message not found");
      const message = normalizeMessage(raw);
      const canDelete =
        message.authorId === member.id || (await canModerate(member.id, message.roomId));
      if (!canDelete) throw new Error("You can only delete your own messages");
      // Soft delete — keeps replies and thread structure intact
      await messageKV.setItem(message.id, {
        ...message,
        text: "",
        deleted: true,
        reactions: {},
        savedBy: [],
        mentions: [],
        audio: null,
        hasAudio: false,
      });
      await messageAudioKV.removeItem(message.id).catch(() => {});
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
      // Content moderation
      const { localFilter, aiModerate } = await import("../lib/moderation");
      const local = localFilter(`${input.title} ${input.body}`);
      let mod = local;
      if (local.flagged) {
        const ai = await aiModerate(`${input.title} ${input.body}`);
        if (ai) mod = ai;
      }
      if (mod.blocked) {
        throw new Error("This discussion was blocked by our content guidelines.");
      }
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
        editedAt: null,
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
      // Content moderation
      const { localFilter, aiModerate } = await import("../lib/moderation");
      const local = localFilter(input.text);
      let mod = local;
      if (local.flagged) {
        const ai = await aiModerate(input.text);
        if (ai) mod = ai;
      }
      if (mod.blocked) {
        throw new Error("This reply was blocked by our content guidelines.");
      }
      const reply: Reply = {
        id: randomUUID(),
        threadId: input.threadId,
        authorId: member.id,
        authorName: member.name,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
      };
      await replyKV.setItem(reply.id, reply);
      await addPoints(member.id, POINTS.REPLY);
      // Notify the thread author about the reply
      const thread = await threadKV.getItem(input.threadId);
      if (thread && thread.authorId !== member.id) {
        const room = await roomKV.getItem(thread.roomId);
        await notify(
          thread.authorId,
          "reply",
          `${member.name} replied to your discussion`,
          `${room ? `In #${room.name} · ` : ""}Re: ${thread.title}`,
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
        const room = await roomKV.getItem(thread.roomId);
        await notify(
          thread.authorId,
          "like",
          `${liker?.name ?? "Someone"} liked your discussion`,
          `${room ? `In #${room.name} · ` : ""}${thread.title}`,
        ).catch(() => {});
      }
      return updated;
    }),
  editThread: os
    .input(
      z.object({
        memberId: z.string(),
        threadId: z.string(),
        title: z.string().min(3).max(200),
        body: z.string().min(3).max(5000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await threadKV.getItem(input.threadId);
      if (!raw) throw new Error("Thread not found");
      const thread = normalizeThread(raw);
      const canEdit =
        thread.authorId === member.id || (await canModerate(member.id, thread.roomId));
      if (!canEdit) throw new Error("You can only edit your own discussions");
      const updated = {
        ...thread,
        title: input.title.trim(),
        body: input.body.trim(),
        editedAt: new Date().toISOString(),
      };
      await threadKV.setItem(updated.id, updated);
      return updated;
    }),
  deleteThread: os
    .input(z.object({ memberId: z.string(), threadId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await threadKV.getItem(input.threadId);
      if (!raw) throw new Error("Thread not found");
      const thread = normalizeThread(raw);
      const canDelete =
        thread.authorId === member.id || (await canModerate(member.id, thread.roomId));
      if (!canDelete) throw new Error("You can only delete your own discussions");
      await threadKV.removeItem(input.threadId);
      for (const r of await replyKV.getAllItems())
        if (r.threadId === input.threadId) await replyKV.removeItem(r.id);
    }),

  editReply: os
    .input(
      z.object({
        memberId: z.string(),
        replyId: z.string(),
        text: z.string().min(1).max(3000),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await replyKV.getItem(input.replyId);
      if (!raw) throw new Error("Reply not found");
      const reply = normalizeReply(raw);
      if (reply.deleted) throw new Error("This reply was deleted");
      const thread = await threadKV.getItem(reply.threadId);
      const canEdit =
        reply.authorId === member.id ||
        (thread ? await canModerate(member.id, thread.roomId) : false);
      if (!canEdit) throw new Error("You can only edit your own replies");
      const updated = { ...reply, text: input.text.trim(), editedAt: new Date().toISOString() };
      await replyKV.setItem(updated.id, updated);
      return updated;
    }),
  deleteReply: os
    .input(z.object({ memberId: z.string(), replyId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const raw = await replyKV.getItem(input.replyId);
      if (!raw) throw new Error("Reply not found");
      const reply = normalizeReply(raw);
      const thread = await threadKV.getItem(reply.threadId);
      const canDelete =
        reply.authorId === member.id ||
        (thread ? await canModerate(member.id, thread.roomId) : false);
      if (!canDelete) throw new Error("You can only delete your own replies");
      await replyKV.setItem(reply.id, { ...reply, text: "", deleted: true });
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
