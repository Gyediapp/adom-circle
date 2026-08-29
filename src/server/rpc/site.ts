import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";

export const SettingsSchema = z.object({
  announcement: z.object({
    text: z.string(),
    enabled: z.boolean(),
  }),
  hero: z.object({
    badge: z.string(),
    title: z.string(),
    highlight: z.string(),
    subtitle: z.string(),
    image: z.string(),
  }),
  stats: z.object({
    members: z.number(),
    projects: z.number(),
    regions: z.number(),
    hours: z.number(),
    volunteers: z.number(),
  }),
  socials: z.array(
    z.object({
      platform: z.enum(["facebook", "whatsapp", "youtube", "tiktok", "other"]),
      label: z.string(),
      url: z.string(),
    }),
  ),
  mission: z.string(),
  vision: z.string(),
  values: z.array(
    z.object({ icon: z.string(), title: z.string(), text: z.string() }),
  ),
  welcome: z.string(),
  footer: z.string(),
  ticker: z.object({
    text: z.string(),
    enabled: z.boolean(),
  }),
});

export type Settings = z.output<typeof SettingsSchema>;

export const settingsKV = createKV<Settings>("settings");

export const DEFAULT_SETTINGS: Settings = {
  announcement: {
    text: "Adom Circle exists for one purpose — a peaceful, prosperous Ghana where every citizen is seen, heard and valued.",
    enabled: true,
  },
  hero: {
    badge: "Ghana's circle of values, civic duty & progress",
    title: "One Circle.",
    highlight: "One Ghana.",
    subtitle:
      "Adom Circle unites Ghanaians at home and abroad in service of peace, development and prosperity — under one Constitution, above every institution.",
    image: "/output/images/hero.jpg",
  },
  stats: {
    members: 12480,
    projects: 86,
    regions: 16,
    hours: 52300,
    volunteers: 3800,
  },
  socials: [
    { platform: "facebook", label: "Facebook Page", url: "https://facebook.com/adomcircle" },
    { platform: "whatsapp", label: "WhatsApp Channel", url: "https://whatsapp.com/channel/adomcircle" },
    { platform: "youtube", label: "YouTube", url: "https://youtube.com/@adomcircle" },
    { platform: "tiktok", label: "TikTok", url: "https://tiktok.com/@adomcircle" },
  ],
  mission:
    "To build a peaceful, values-driven Ghanaian community that contributes to national development, participates in the economy, and upholds the Constitution of Ghana above every denomination, institution or group.",
  vision:
    "A Ghana where peace, faith, family and constitutional order are preserved for every generation — and where every Ghanaian, at home or abroad, has a circle to belong to.",
  values: [
    {
      icon: "scale",
      title: "Constitution Above All",
      text: "The Constitution of Ghana is supreme over any denomination, institution or group. Every member accepts and abides by it.",
    },
    {
      icon: "dove",
      title: "Peaceful Coexistence",
      text: "We respect religious freedom and peaceful coexistence while valuing the historic role of Christian and traditional values in Ghana's peace.",
    },
    {
      icon: "heart",
      title: "Social Contribution",
      text: "We track and celebrate real contributions to the Motherland — time, skills, resources and service to communities.",
    },
    {
      icon: "trending",
      title: "Economic Participation",
      text: "We invest, build and buy Ghanaian — supporting local businesses, entrepreneurship, and responsible investment at home.",
    },
    {
      icon: "vote",
      title: "Civic Duty",
      text: "Peace is not guaranteed forever. We stay engaged, register, and vote for leaders who uphold our values and the Constitution.",
    },
  ],
  welcome:
    "Welcome to Adom Circle. Every Ghanaian who accepts the Constitution of Ghana and respects peaceful coexistence is welcome here — at home or in the diaspora.",
  footer:
    "Adom Circle — uniting Ghanaians under one Constitution, for a peaceful and prosperous Ghana. © 2026 Adom Circle.",
  ticker: {
    text: "Register to vote · Know the Constitution · Peace is everyone's duty 🇬🇭",
    enabled: true,
  },
};

export const site = {
  get: os.handler(async () => {
    const items = await settingsKV.getAllItems();
    return items[0] ?? DEFAULT_SETTINGS;
  }),

  update: os
    .input(z.object({ adminId: z.string(), settings: SettingsSchema }))
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const admin = await memberKV.getItem(input.adminId);
      if (!admin || admin.role !== "admin") throw new Error("Admin access required");
      await settingsKV.setItem("settings", input.settings);
      return input.settings;
    }),

  reset: os.input(z.object({ adminId: z.string() })).handler(async ({ input }) => {
    const { memberKV } = await import("./members");
    const admin = await memberKV.getItem(input.adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");
    await settingsKV.setItem("settings", DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }),
};

// ---------- Posts (featured content) ----------

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: z.enum(["News", "Story", "Civic", "Economy", "Values"]),
  author: z.string(),
  image: z.string(),
  featured: z.boolean(),
  createdAt: z.string(),
});

export type Post = z.output<typeof PostSchema>;

export const postKV = createKV<Post>("posts");

const seedPost = (
  p: Omit<Post, "id" | "createdAt">,
): Post => ({ ...p, id: randomUUID(), createdAt: new Date().toISOString() });

export const posts = {
  list: os.handler(async () => {
    return (await postKV.getAllItems()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }),

  create: os
    .input(
      z.object({
        adminId: z.string(),
        post: PostSchema.omit({ id: true, createdAt: true }),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const admin = await memberKV.getItem(input.adminId);
      if (!admin || admin.role !== "admin") throw new Error("Admin access required");
      const post = seedPost(input.post);
      await postKV.setItem(post.id, post);
      return post;
    }),

  toggleFeatured: os
    .input(z.object({ adminId: z.string(), postId: z.string() }))
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const admin = await memberKV.getItem(input.adminId);
      if (!admin || admin.role !== "admin") throw new Error("Admin access required");
      const post = await postKV.getItem(input.postId);
      if (!post) throw new Error("Post not found");
      const updated = { ...post, featured: !post.featured };
      await postKV.setItem(post.id, updated);
      return updated;
    }),

  remove: os
    .input(z.object({ adminId: z.string(), postId: z.string() }))
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const admin = await memberKV.getItem(input.adminId);
      if (!admin || admin.role !== "admin") throw new Error("Admin access required");
      await postKV.removeItem(input.postId);
    }),
};
