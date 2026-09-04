export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace(".0k", "k");
  return n.toLocaleString();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "#CE1126",
  "#006B3F",
  "#B45309",
  "#0E7490",
  "#7C3AED",
  "#DB2777",
  "#1D4A38",
  "#C2410C",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// --- Online/offline presence ---
// A member is "online" if they were active in the last 5 minutes.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  return Date.now() - t < ONLINE_WINDOW_MS;
}

export function presenceLabel(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return "Offline";
  if (isOnline(lastSeenAt)) return "Online";
  return `Last seen ${timeAgo(lastSeenAt)}`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
