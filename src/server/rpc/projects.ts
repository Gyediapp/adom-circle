import { call, os } from "@orpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createKV } from "../lib/create-kv";
import { addPoints, requireAdmin } from "./members";
import { POINTS } from "../data/ranks";

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  region: z.string(),
  theme: z.enum([
    "Education",
    "Health",
    "Youth",
    "Environment",
    "Civic",
    "Economic",
  ]),
  status: z.enum(["planned", "ongoing", "completed"]),
  volunteers: z.number(),
  hours: z.number(),
  sponsor: z.string(),
  image: z.string(),
  submittedBy: z.string(),
  createdAt: z.string(),
  milestones: z.array(z.string()),
});

export type Project = z.output<typeof ProjectSchema>;

export const projectKV = createKV<Project>("projects");

export const ContributionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  type: z.enum(["Time", "Skills", "Resources", "Financial"]),
  note: z.string(),
  hours: z.number(),
  createdAt: z.string(),
});

export type Contribution = z.output<typeof ContributionSchema>;

export const contributionKV = createKV<Contribution>("contributions");

const getProjects = os.handler(async () => {
  return (await projectKV.getAllItems()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
});

const getProject = os.input(z.string()).handler(async ({ input }) => {
  const project = await projectKV.getItem(input);
  if (!project) throw new Error("Project not found");
  const contributions = (await contributionKV.getAllItems())
    .filter((c) => c.projectId === input)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { project, contributions };
});

export const projects = {
  getProjects,
  getProject,
  liveProjects: {
    list: os.handler(async function* ({ signal }) {
      yield call(getProjects, {}, { signal });
      for await (const _ of projectKV.subscribe()) {
        yield call(getProjects, {}, { signal });
      }
    }),
  },

  // Any member can submit a project proposal (status starts "planned")
  submit: os
    .input(
      z.object({
        memberId: z.string(),
        title: z.string().min(3).max(150),
        description: z.string().min(10).max(3000),
        location: z.string(),
        region: z.string(),
        theme: ProjectSchema.shape.theme,
        sponsor: z.string(),
        image: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      const project: Project = {
        id: randomUUID(),
        ...input,
        status: "planned",
        volunteers: 0,
        hours: 0,
        submittedBy: member.name,
        createdAt: new Date().toISOString(),
        milestones: [],
      };
      await projectKV.setItem(project.id, project);
      return project;
    }),

  setStatus: os
    .input(
      z.object({
        adminId: z.string(),
        projectId: z.string(),
        status: z.enum(["planned", "ongoing", "completed"]),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const p = await projectKV.getItem(input.projectId);
      if (!p) throw new Error("Project not found");
      const updated = { ...p, status: input.status };
      await projectKV.setItem(p.id, updated);
      return updated;
    }),

  removeProject: os
    .input(z.object({ adminId: z.string(), projectId: z.string() }))
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      await projectKV.removeItem(input.projectId);
    }),

  addContribution: os
    .input(
      z.object({
        memberId: z.string(),
        projectId: z.string(),
        type: ContributionSchema.shape.type,
        note: z.string(),
        hours: z.number().default(0),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      const project = await projectKV.getItem(input.projectId);
      if (!project) throw new Error("Project not found");

      const contribution: Contribution = {
        id: randomUUID(),
        projectId: input.projectId,
        memberId: member.id,
        memberName: member.name,
        type: input.type,
        note: input.note,
        hours: input.type === "Time" ? input.hours : 0,
        createdAt: new Date().toISOString(),
      };
      await contributionKV.setItem(contribution.id, contribution);

      const updated: Project = {
        ...project,
        volunteers: project.volunteers + 1,
        hours: project.hours + contribution.hours,
      };
      await projectKV.setItem(project.id, updated);
      await addPoints(member.id, POINTS.CONTRIBUTION);
      return contribution;
    }),
};
