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

// ---------- Project tasks (kanban) ----------

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  assignee: z.string(), // member id or "" for unassigned
  status: z.enum(TASK_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Task = z.output<typeof TaskSchema>;

export const taskKV = createKV<Task>("tasks");

function normalizeTask(t: Task): Task {
  return {
    ...t,
    assignee: t.assignee ?? "",
    status: t.status ?? "todo",
  };
}

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

const getTasks = os.input(z.object({ projectId: z.string() })).handler(async ({ input }) => {
  return (await taskKV.getAllItems())
    .filter((t) => t.projectId === input.projectId)
    .map(normalizeTask)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

  // ----- Kanban tasks -----

  getTasks,

  liveTasks: {
    list: os
      .input(z.object({ projectId: z.string() }))
      .handler(async function* ({ input, signal }) {
        yield call(getTasks, { projectId: input.projectId }, { signal });
        for await (const _ of taskKV.subscribe()) {
          yield call(getTasks, { projectId: input.projectId }, { signal });
        }
      }),
  },

  createTask: os
    .input(
      z.object({
        memberId: z.string(),
        projectId: z.string(),
        title: z.string().min(2).max(200),
        assignee: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      const project = await projectKV.getItem(input.projectId);
      if (!project) throw new Error("Project not found");
      const now = new Date().toISOString();
      const task: Task = {
        id: randomUUID(),
        projectId: input.projectId,
        title: input.title.trim(),
        assignee: input.assignee ?? "",
        status: "todo",
        createdAt: now,
        updatedAt: now,
      };
      await taskKV.setItem(task.id, task);
      return task;
    }),

  moveTask: os
    .input(
      z.object({
        memberId: z.string(),
        taskId: z.string(),
        status: z.enum(TASK_STATUSES),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      const raw = await taskKV.getItem(input.taskId);
      if (!raw) throw new Error("Task not found");
      const updated: Task = {
        ...normalizeTask(raw),
        status: input.status,
        updatedAt: new Date().toISOString(),
      };
      await taskKV.setItem(updated.id, updated);
      return updated;
    }),

  assignTask: os
    .input(
      z.object({
        memberId: z.string(),
        taskId: z.string(),
        assignee: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      const raw = await taskKV.getItem(input.taskId);
      if (!raw) throw new Error("Task not found");
      const updated: Task = {
        ...normalizeTask(raw),
        assignee: input.assignee,
        updatedAt: new Date().toISOString(),
      };
      await taskKV.setItem(updated.id, updated);
      return updated;
    }),

  deleteTask: os
    .input(z.object({ memberId: z.string(), taskId: z.string() }))
    .handler(async ({ input }) => {
      const { memberKV } = await import("./members");
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found. Please sign in.");
      // Guardrail: only moderators/admins can delete tasks (members add/move)
      if (member.role !== "admin" && member.role !== "moderator") {
        throw new Error("Only moderators and admins can delete tasks.");
      }
      await taskKV.removeItem(input.taskId);
    }),
};
