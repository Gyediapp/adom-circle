import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown, MapPin, Vote, ShieldCheck, Award, TrendingUp, Eye } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Avatar, Chip, Modal, ProgressBar, Button, Toggle } from "./ui";
import { RankChip, rankIcon } from "@/client/lib/ranks";
import { rankFor, nextRank, rankProgress, RANKS } from "@/server/data/ranks";
import { regionName } from "@/server/data/regions";
import { cn } from "@/client/lib/format";

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();

  const { data: member } = useQuery(
    queryClient.members.byId.queryOptions({
      input: user?.id ?? "",
      enabled: !!user && open,
    }),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { toast } = useStore();

  const savePrivacy = useMutation(
    queryClient.members.update.mutationOptions({
      onSuccess: () => toast("Privacy settings saved"),
      onError: (e: any) => toast(e?.message ?? "Failed to save", "error"),
    }),
  );

  if (!member) return null;

  const rank = rankFor(member.points);
  const next = nextRank(member.points);
  const progress = rankProgress(member.points);
  const managed = rooms?.filter((r) => member.managedRooms.includes(r.id)) ?? [];

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar name={member.name} size={64} className="ring-4 ring-flag-gold" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight">{member.name}</p>
            <p className="mt-1 text-sm text-fg/50">
              {member.profession || "Adom Circle member"} · {regionName(member.region)}
              {member.diasporaCountry ? ` · 📍 ${member.diasporaCountry}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone={member.role === "admin" ? "red" : member.role === "vip" ? "gold" : "green"} className="capitalize">
                {member.role === "vip" ? <Crown size={11} /> : <ShieldCheck size={11} />}
                {member.role}
              </Chip>
              <RankChip points={member.points} role={member.role} size="md" />
            </div>
          </div>
        </div>

        {member.bio && <p className="mt-4 text-sm leading-relaxed text-fg/65">{member.bio}</p>}

        {/* Rank progress */}
        <div className="mt-6 rounded-2xl bg-ink p-5 text-cream">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-lg font-bold">
              <span style={{ color: rank.color }}>{rankIcon(rank)}</span> {rank.title}
            </p>
            <span className="text-sm font-bold text-flag-gold">{member.points.toLocaleString()} pts</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>
          <p className="mt-2 text-[12px] text-cream/60">
            {next ? (
              <>
                <TrendingUp size={12} className="mr-1 inline" />
                {next.min - member.points} points to {next.title} — keep contributing!
              </>
            ) : (
              "Highest rank reached — you are a true Ambassador of the Circle 🏆"
            )}
          </p>
        </div>

        {/* Badges */}
        {member.badges.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
              <Award size={13} className="text-flag-red" /> Badges
            </p>
            <div className="flex flex-wrap gap-2">
              {member.badges.map((b) => (
                <Chip key={b} tone={b === "Voter" ? "green" : "sand"}>{b}</Chip>
              ))}
            </div>
          </div>
        )}

        {/* Delegation */}
        {managed.length > 0 && (
          <div className="mt-6 rounded-2xl border border-flag-green/25 bg-flag-green/5 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-flag-green">
              <ShieldCheck size={13} /> Rooms you moderate
            </p>
            <div className="flex flex-wrap gap-2">
              {managed.map((r) => (
                <Chip key={r.id} tone="green">{r.icon} {r.name}</Chip>
              ))}
            </div>
          </div>
        )}

        {/* Pledge */}
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-soft/70 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg/70">
            <Vote size={15} className="text-flag-red" /> Voter's pledge
          </p>
          {member.pledgeVote ? (
            <Chip tone="green">Pledged 🇬🇭</Chip>
          ) : (
            <Chip tone="sand">Not yet</Chip>
          )}
        </div>

        {/* Region + hometown */}
        <div className="mt-4 flex flex-wrap gap-3 text-[12px] font-semibold text-fg/50">
          <span className="flex items-center gap-1.5">
            <MapPin size={12} className="text-flag-red" />
            {regionName(member.region)}
            {member.hometown ? ` · ${member.hometown}` : ""}
          </span>
          {member.church && <span className="flex items-center gap-1.5">⛪ {member.church}</span>}
        </div>

        {/* Rank ladder */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-fg/50">The rank ladder</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {RANKS.map((r) => (
              <div
                key={r.level}
                className={cn(
                  "rounded-xl border px-2 py-2 text-center",
                  member.points >= r.min
                    ? "border-flag-gold bg-gold-soft/40"
                    : "border-fg/10 bg-card opacity-50",
                )}
              >
                <span className="block text-sm" style={{ color: r.color }}>{rankIcon(r)}</span>
                <span className="mt-0.5 block text-[9px] font-bold leading-tight">{r.title}</span>
                <span className="block text-[9px] text-fg/40">{r.min} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy — what others can see about you */}
        <div className="mt-6 rounded-2xl border border-fg/10 bg-soft/40 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
            <Eye size={13} className="text-flag-red" /> What others can see
          </p>
          <div className="space-y-2">
            {(
              [
                ["showRegion", "Region"],
                ["showHometown", "Hometown"],
                ["showProfession", "Profession"],
                ["showBadges", "Badges"],
                ["showPoints", "Points & rank"],
              ] as Array<[keyof NonNullable<typeof member.privacy>, string]>
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-card border border-fg/8 px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-fg/75">{label}</span>
                <Toggle
                  checked={member.privacy?.[key] ?? true}
                  onChange={(v) => {
                    const next = { ...member.privacy, [key]: v };
                    savePrivacy.mutate({ id: member.id, patch: { privacy: next } as any });
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-fg/45">
            Hidden fields still show to moderators and admins for safety.
          </p>
        </div>

        <Button variant="dark" className="mt-6 w-full py-3" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
