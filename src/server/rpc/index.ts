import { members } from "./members";
import { site, posts } from "./site";
import { community } from "./community";
import { projects } from "./projects";
import { events } from "./events";
import { notifications } from "./notifications";
import { emails } from "./emails";
import { admin } from "./admin";
import { dms } from "./dms";
import { polls } from "./polls";
import { seed } from "./seed";

// Populate demo data on first boot
seed().catch((err) => console.error("Seed failed:", err));

export const router = {
  members,
  site,
  posts,
  community,
  projects,
  events,
  notifications,
  emails,
  admin,
  dms,
  polls,
};
