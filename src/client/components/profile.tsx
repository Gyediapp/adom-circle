import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, MapPin, Vote, ShieldCheck, Award, TrendingUp, Eye, UserPlus, Check, X, Clock, Users, Camera, ImagePlus, Loader2 } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Avatar, Chip, Modal, ProgressBar, Button, Toggle } from "./ui";
import { RankChip, rankIcon } from "@/client/lib/ranks";
import { rankFor, nextRank, rankProgress, RANKS } from "@/server/data/ranks";
import { regionName } from "@/server/data/regions";
import { cn } from "@/client/lib/format";

// Downscale + compress an image file to a small JPEG data URL (client-side,
// so member records stay light and nothing heavy is uploaded).
async function readImageFile(file: File, maxW: number, maxH: number): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process this image");
  ctx.fillStyle = "#faf6ec"; // opaque backdrop for transparent images (PNG)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.82);
}

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, toast, refresh, setUser } = useStore();
  const [photoBusy, setPhotoBusy] = useState<"avatar" | "cover" | null>(null);

  const { data: member } = useQuery(
    queryClient.members.byId.queryOptions({
      input: user?.id ?? "",
      enabled: !!user && open,
    }),
  );
  const { data: friendReqs } = useQuery(
    queryClient.members.friendRequests.queryOptions({
      input: { memberId: user?.id ?? "" },
      enabled: !!user && open && !!member,
    }),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const tanQuery = useQueryClient();

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      tanQuery.invalidateQueries({ queryKey: ["members"] });
      await refresh();
    } catch (e: any) {
      toast(e?.message ?? "Failed", "error");
    }
  };

  const onPickPhoto = async (kind: "avatar" | "cover", file?: File | null) => {
    if (!file || !user) return;
    setPhotoBusy(kind);
    try {
      const data =
        kind === "avatar" ? await readImageFile(file, 512, 512) : await readImageFile(file, 1280, 420);
      const updated = await rpcClient.members.uploadImages({
        memberId: user.id,
        avatarImage: kind === "avatar" ? data : undefined,
        coverImage: kind === "cover" ? data : undefined,
      });
      setUser(updated);
      tanQuery.invalidateQueries({ queryKey: ["members", "byId", user.id] });
      toast(kind === "avatar" ? "Profile photo updated 📸" : "Cover photo updated 📸");
    } catch (e: any) {
      toast(e?.message ?? "Could not upload that photo", "error");
    } finally {
      setPhotoBusy(null);
    }
  };

  const savePrivacy = useMutation(
    queryClient.members.update.mutationOptions({
      onSuccess: () => {
        toast("Privacy settings saved");
        // Refresh the profile so the toggles reflect the saved state
        tanQuery.invalidateQueries({ queryKey: ["members", "byId", user?.id] });
      },
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
        {/* Cover photo banner */}
        {member.coverImage && (
          <div className="relative -mx-6 -mt-6 mb-5 h-24 overflow-hidden rounded-t-3xl sm:-mx-8 sm:-mt-8">
            <img src={member.coverImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
          </div>
        )}
        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar name={member.name} size={64} className="ring-4 ring-flag-gold" src={member.avatarImage} />
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

        {/* Friends — requests in, pending out, count */}
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
            <Users size={13} className="text-flag-red" /> Friends
            <span className="rounded-full bg-flag-green/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-flag-green">
              {(member.friends ?? []).length}
            </span>
            {friendReqs && friendReqs.incoming.length > 0 && (
              <span className="rounded-full bg-flag-red/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-flag-red">
                {friendReqs.incoming.length} request{friendReqs.incoming.length === 1 ? "" : "s"}
              </span>
            )}
          </p>

          {friendReqs && friendReqs.incoming.length > 0 && (
            <div className="mb-2 space-y-2">
              {friendReqs.incoming.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-flag-gold/30 bg-flag-gold/5 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-[13px] font-bold">{r.fromName}</span>
                  <button
                    onClick={() =>
                      act(
                        () => rpcClient.members.respondFriendRequest({ memberId: user!.id, requestId: r.id, accept: true }),
                        `${r.fromName} is now your friend 🎉`,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-flag-green px-3 py-1.5 text-xs font-bold text-cream hover:bg-[#00552f] transition-colors cursor-pointer"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={() =>
                      act(
                        () => rpcClient.members.respondFriendRequest({ memberId: user!.id, requestId: r.id, accept: false }),
                        "Request declined",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-fg/15 px-3 py-1.5 text-xs font-bold text-fg/55 hover:text-flag-red hover:border-flag-red/40 transition-colors cursor-pointer"
                  >
                    <X size={12} /> Decline
                  </button>
                </div>
              ))}
            </div>
          )}

          {friendReqs && friendReqs.outgoing.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {friendReqs.outgoing.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl bg-soft/60 px-4 py-2 text-[13px]">
                  <Clock size={13} className="shrink-0 text-fg/40" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg/65">
                    Request to {r.toName} — pending
                  </span>
                  <button
                    onClick={() =>
                      act(
                        () => rpcClient.members.cancelFriendRequest({ memberId: user!.id, requestId: r.id }),
                        "Request cancelled",
                      )
                    }
                    className="rounded-full p-1 text-fg/35 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                    title="Cancel request"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(!friendReqs || (friendReqs.incoming.length === 0 && friendReqs.outgoing.length === 0)) && (
            <p className="text-[12px] text-fg/45">
              Add friends from the community — a request is only accepted when the other person agrees.
            </p>
          )}
        </div>

        {/* Photos — profile photo + cover */}
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
            <Camera size={13} className="text-flag-red" /> Profile photos
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-2xl border border-fg/10 bg-soft/40 px-4 py-2.5">
              <Avatar name={member.name} size={44} src={member.avatarImage} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">Profile photo</p>
                <p className="text-[11px] text-fg/45">Shown next to your name across the circle</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!!photoBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    onPickPhoto("avatar", f);
                  }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-fg/15 px-3 py-1.5 text-xs font-bold text-fg/70 hover:border-flag-red hover:text-flag-red transition-colors">
                  {photoBusy === "avatar" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {member.avatarImage ? "Change" : "Upload"}
                </span>
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-fg/10 bg-soft/40 px-4 py-2.5">
              <span className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
                {member.coverImage ? (
                  <img src={member.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={16} className="text-fg/35" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">Cover photo</p>
                <p className="text-[11px] text-fg/45">The banner at the top of your profile</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!!photoBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    onPickPhoto("cover", f);
                  }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-fg/15 px-3 py-1.5 text-xs font-bold text-fg/70 hover:border-flag-green hover:text-flag-green transition-colors">
                  {photoBusy === "cover" ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                  {member.coverImage ? "Change" : "Upload"}
                </span>
              </label>
            </div>
          </div>
        </div>

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
            ).map(([key, label]) => {
              const on = member.privacy?.[key] ?? true;
              return (
                <button
                  key={key}
                  onClick={() => {
                    const next = { ...member.privacy, [key]: !on };
                    savePrivacy.mutate({ id: member.id, patch: { privacy: next } as any });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors cursor-pointer",
                    on
                      ? "border-flag-green/40 bg-flag-green/5"
                      : "border-fg/10 bg-card opacity-80",
                  )}
                >
                  <span className={cn("text-[13px] font-semibold", on ? "text-flag-green" : "text-fg/60")}>
                    {label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        on ? "bg-flag-green text-cream" : "bg-ink/10 text-fg/50",
                      )}
                    >
                      {on ? "On" : "Off"}
                    </span>
                    <span
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        on ? "bg-flag-green" : "bg-ink/20",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform",
                          on ? "translate-x-[18px]" : "translate-x-0.5",
                        )}
                      />
                    </span>
                  </span>
                </button>
              );
            })}
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
