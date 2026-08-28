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
};
