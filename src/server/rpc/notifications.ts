import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";

export const NotificationSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  type: z.enum(["reply", "like", "event", "rank", "broadcast", "system", "dm"]),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});

export type Notification = z.output<typeof NotificationSchema>;

export const notificationKV = createKV<Notification>("notifications");

export async function notify(
  memberId: string,
  type: Notification["type"],
  title: string,
  body: string,
): Promise<void> {
  const n: Notification = {
    id: randomUUID(),
    memberId,
    type,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await notificationKV.setItem(n.id, n);
}

export const notifications = {
  list: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      return (await notificationKV.getAllItems())
        .filter((n) => n.memberId === input.memberId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40);
    }),

  unreadCount: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      return (await notificationKV.getAllItems()).filter(
        (n) => n.memberId === input.memberId && !n.read,
      ).length;
    }),

  markRead: os
    .input(z.object({ memberId: z.string(), notificationId: z.string() }))
    .handler(async ({ input }) => {
      const n = await notificationKV.getItem(input.notificationId);
      if (!n || n.memberId !== input.memberId) return null;
      const updated = { ...n, read: true };
      await notificationKV.setItem(n.id, updated);
      return updated;
    }),

  markAllRead: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      for (const n of await notificationKV.getAllItems()) {
        if (n.memberId === input.memberId && !n.read) {
          await notificationKV.setItem(n.id, { ...n, read: true });
        }
      }
    }),

  clear: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      for (const n of await notificationKV.getAllItems()) {
        if (n.memberId === input.memberId) {
          await notificationKV.removeItem(n.id);
        }
      }
    }),

  broadcast: os
    .input(
      z.object({
        adminId: z.string(),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      const { requireAdmin } = await import("./members");
      await requireAdmin(input.adminId);
      const { memberKV } = await import("./members");
      const members = await memberKV.getAllItems();
      for (const m of members) {
        await notify(m.id, "broadcast", input.title, input.body);
      }
      return members.length;
    }),
};
