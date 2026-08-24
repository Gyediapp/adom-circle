import { Crown, Handshake, Leaf, Medal, Sparkles, Sprout } from "lucide-react";
import { RANKS, rankFor, type Rank } from "@/server/data/ranks";
import { cn } from "./format";

const ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout size={12} />,
  leaf: <Leaf size={12} />,
  handshake: <Handshake size={12} />,
  medal: <Medal size={12} />,
  sparkles: <Sparkles size={12} />,
  crown: <Crown size={12} />,
};

export function rankIcon(rank: Rank): React.ReactNode {
  return ICONS[rank.icon] ?? <Sprout size={12} />;
}

// Badge shown next to member names — the "climbing the ranks" indicator
export function RankChip({
  points,
  role,
  size = "sm",
  className,
}: {
  points: number;
  role?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const rank = rankFor(points);
  const isVip = role === "vip";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full font-bold", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        )}
        style={{ background: `${rank.color}1a`, color: rank.color }}
      >
        {rankIcon(rank)}
        {rank.title}
      </span>
      {isVip && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-flag-red to-flag-green px-2 py-0.5 text-[10px] text-cream">
          <Crown size={10} /> VIP
        </span>
      )}
    </span>
  );
}

export const RANKS_LIST = RANKS;
