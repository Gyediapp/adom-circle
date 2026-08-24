import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { addPoints, canCreateEvents, requireAdmin, requireMember } from "./members";
import { POINTS } from "../data/ranks";
import { notify } from "./notifications";

// ---------- Events & Activities ----------

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  time: z.string(),
  location: z.string(),
  region: z.string(),
  mode: z.enum(["physical", "virtual"]),
  category: z.enum(["Civic", "Social", "Fundraiser", "Workshop", "Meetup", "Volunteer"]),
  organizer: z.string(),
  image: z.string(),
  featured: z.boolean(),
  attendees: z.array(z.string()),
  attendeeCount: z.number(),
  createdAt: z.string(),
});

export type Event = z.output<typeof EventSchema>;

export const eventKV = createKV<Event>("events");

// ---------- Ads / Showcase ----------

export const AdSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  image: z.string(),
  link: z.string(),
  sponsor: z.string(),
  placement: z.enum(["home", "events", "both"]),
  active: z.boolean(),
  clicks: z.number(),
  createdAt: z.string(),
});

export type Ad = z.output<typeof AdSchema>;

export const adKV = createKV<Ad>("ads");

// ---------- Router ----------

export const events = {
  // ----- Events -----
  list: os.handler(async () => {
    return (await eventKV.getAllItems()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }),

  create: os
    .input(
      z.object({
        memberId: z.string(),
        event: EventSchema.omit({ id: true, createdAt: true, attendees: true, attendeeCount: true }),
      }),
    )
    .handler(async ({ input }) => {
      const member = await canCreateEvents(input.memberId);
      const event: Event = {
        ...input.event,
        id: randomUUID(),
        attendees: [],
        attendeeCount: 0,
        createdAt: new Date().toISOString(),
      };
      await eventKV.setItem(event.id, event);
      // Fan out a notification to every member (skip the organizer)
      const { memberKV } = await import("./members");
      const members = await memberKV.getAllItems();
      const when = `${new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${event.time}`;
      for (const m of members) {
        if (m.id === member.id) continue;
        await notify(
          m.id,
          "event",
          `New event: ${event.title}`,
          `${when} · ${event.location}`,
        ).catch(() => {});
      }
      return { event, organizer: member.name };
    }),

  rsvp: os
    .input(z.object({ memberId: z.string(), eventId: z.string() }))
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      const event = await eventKV.getItem(input.eventId);
      if (!event) throw new Error("Event not found");
      const attending = event.attendees.includes(member.id);
      let updated: Event;
      if (attending) {
        updated = {
          ...event,
          attendees: event.attendees.filter((id) => id !== member.id),
          attendeeCount: Math.max(0, event.attendeeCount - 1),
        };
      } else {
        updated = {
          ...event,
          attendees: [...event.attendees, member.id],
          attendeeCount: event.attendeeCount + 1,
        };
        await addPoints(member.id, POINTS.EVENT_RSVP);
      }
      await eventKV.setItem(event.id, updated);
      return updated;
    }),

  toggleFeatured: os
    .input(z.object({ adminId: z.string(), eventId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const event = await eventKV.getItem(input.eventId);
      if (!event) throw new Error("Event not found");
      const updated = { ...event, featured: !event.featured };
      await eventKV.setItem(event.id, updated);
      return updated;
    }),

  remove: os
    .input(z.object({ adminId: z.string(), eventId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await eventKV.removeItem(input.eventId);
    }),

  // ----- Ads / Showcase -----
  adsPublic: os.handler(async () => {
    return (await adKV.getAllItems())
      .filter((a) => a.active)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),

  adsAll: os
    .input(z.object({ adminId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      return (await adKV.getAllItems()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    }),

  adCreate: os
    .input(
      z.object({
        adminId: z.string(),
        ad: AdSchema.omit({ id: true, clicks: true, createdAt: true }),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const ad: Ad = {
        ...input.ad,
        id: randomUUID(),
        clicks: 0,
        createdAt: new Date().toISOString(),
      };
      await adKV.setItem(ad.id, ad);
      return ad;
    }),

  adToggle: os
    .input(z.object({ adminId: z.string(), adId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const ad = await adKV.getItem(input.adId);
      if (!ad) throw new Error("Ad not found");
      const updated = { ...ad, active: !ad.active };
      await adKV.setItem(ad.id, updated);
      return updated;
    }),

  adRemove: os
    .input(z.object({ adminId: z.string(), adId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await adKV.removeItem(input.adId);
    }),

  adClick: os.input(z.object({ adId: z.string() })).handler(async ({ input }) => {
    const ad = await adKV.getItem(input.adId);
    if (!ad) return null;
    const updated = { ...ad, clicks: ad.clicks + 1 };
    await adKV.setItem(ad.id, updated);
    return updated;
  }),
};
