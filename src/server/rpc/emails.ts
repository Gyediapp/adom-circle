import { os } from "@orpc/server";
import { z } from "zod";
import { createKV } from "../lib/create-kv";
import { requireAdmin } from "./members";

export const EmailSchema = z.object({
  id: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  debugCode: z.string().nullable(),
  sentAt: z.string(),
  read: z.boolean(),
});

export type OutboxEmail = z.output<typeof EmailSchema>;

// Demo outbox — every email the app "sends" lands here so flows are testable.
// In production, swap sendEmail() in members.ts for a real SMTP provider;
// this mailbox then becomes an audit log.
export const emailKV = createKV<OutboxEmail>("emails");

export const emails = {
  list: os.input(z.object({ adminId: z.string() })).handler(async ({ input }) => {
    await requireAdmin(input.adminId);
    return (await emailKV.getAllItems()).sort((a, b) =>
      b.sentAt.localeCompare(a.sentAt),
    );
  }),

  markRead: os
    .input(z.object({ adminId: z.string(), emailId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const e = await emailKV.getItem(input.emailId);
      if (!e) return null;
      const updated = { ...e, read: true };
      await emailKV.setItem(e.id, updated);
      return updated;
    }),

  remove: os
    .input(z.object({ adminId: z.string(), emailId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await emailKV.removeItem(input.emailId);
    }),

  clear: os.input(z.object({ adminId: z.string() })).handler(async ({ input }) => {
    await requireAdmin(input.adminId);
    for (const e of await emailKV.getAllItems()) {
      await emailKV.removeItem(e.id);
    }
  }),
};
