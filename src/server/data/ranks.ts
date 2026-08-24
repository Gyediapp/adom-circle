// Rank ladder — members climb ranks as they earn activity points.
// Shared between server (points awarding) and client (badge display).

export interface Rank {
  level: number;
  title: string;
  icon: string; // lucide icon key, mapped on the client
  min: number;
  color: string;
}

export const RANKS: Rank[] = [
  { level: 1, title: "New Member", icon: "sprout", min: 0, color: "#94a3b8" },
  { level: 2, title: "Grassroots", icon: "leaf", min: 50, color: "#006B3F" },
  { level: 3, title: "Contributor", icon: "handshake", min: 150, color: "#0E7490" },
  { level: 4, title: "Champion", icon: "medal", min: 400, color: "#B45309" },
  { level: 5, title: "Community Leader", icon: "sparkles", min: 800, color: "#7C3AED" },
  { level: 6, title: "Ambassador", icon: "crown", min: 1500, color: "#CE1126" },
];

export function rankFor(points: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.min) current = r;
  }
  return current;
}

export function nextRank(points: number): Rank | null {
  return RANKS.find((r) => r.min > points) ?? null;
}

export function rankProgress(points: number): number {
  const current = rankFor(points);
  const next = nextRank(points);
  if (!next) return 100;
  const span = next.min - current.min;
  return Math.min(100, Math.round(((points - current.min) / span) * 100));
}

// Points awarded for actions
export const POINTS = {
  SIGNUP: 10,
  MESSAGE: 1,
  THREAD: 5,
  REPLY: 2,
  CONTRIBUTION: 25,
  PLEDGE: 20,
  EVENT_RSVP: 15,
} as const;
