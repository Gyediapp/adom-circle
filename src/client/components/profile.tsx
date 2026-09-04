import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, MapPin, Vote, ShieldCheck, Award, TrendingUp, Eye, UserPlus, Check, X, Clock, Users, Camera, ImagePlus, Loader2, Crop, Pencil, RotateCcw, ZoomIn, Church, Briefcase, Home, Globe } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Avatar, Chip, Modal, ProgressBar, Button } from "./ui";
import { RankChip, rankIcon } from "@/client/lib/ranks";
import { rankFor, nextRank, rankProgress, RANKS } from "@/server/data/ranks";
import { regionName } from "@/server/data/regions";
import { cn } from "@/client/lib/format";
import type { PublicMember } from "@/server/rpc/members";

/* ------------------------------------------------------------------ */
/* Crop modal — pick a photo, then drag + zoom to frame it exactly.    */
/* The visible area is drawn to a canvas at the target size and saved. */
/* ------------------------------------------------------------------ */

function CropModal({
  kind,
  file,
  onCancel,
  onDone,
}: {
  kind: "avatar" | "cover";
  file: File;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const { toast } = useStore();
  const aspect = kind === "avatar" ? 1 : 1280 / 420;
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [url, setUrl] = useState("");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setNatural(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Measure the crop box once it has a real size (its aspect ratio is set by CSS)
  useEffect(() => {
    const el = boxRef.current;
    if (!vp && el && el.clientWidth > 0 && el.clientHeight > 0) {
      setVp({ w: el.clientWidth, h: el.clientHeight });
    }
  }, [vp, url]);

  // Start fully zoomed-out: the whole image fits one dimension, others cropped away
  const scaleFor = (z: number) =>
    natural && vp ? Math.max(vp.w / natural.w, vp.h / natural.h) * z : 1;

  const changeZoom = (z: number) => {
    const base = natural && vp ? Math.max(vp.w / natural.w, vp.h / natural.h) : 0;
    const sc = base * z;
    const mx = natural && vp ? Math.max(0, (natural.w * sc - vp.w) / 2) : 0;
    const my = natural && vp ? Math.max(0, (natural.h * sc - vp.h) / 2) : 0;
    const k = z / zoom;
    setZoom(z);
    setOff({
      x: Math.min(mx, Math.max(-mx, off.x * k)),
      y: Math.min(my, Math.max(-my, off.y * k)),
    });
  };

  const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v));

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const scale = scaleFor(zoom);
    const mx = natural ? Math.max(0, (natural.w * scale - vp!.w) / 2) : 0;
    const my = natural ? Math.max(0, (natural.h * scale - vp!.h) / 2) : 0;
    setOff({
      x: clamp(d.ox + (e.clientX - d.x), mx),
      y: clamp(d.oy + (e.clientY - d.y), my),
    });
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const confirm = async () => {
    const img = imgRef.current;
    if (!img || !natural || !vp || busy) return;
    setBusy(true);
    try {
      const total = scaleFor(zoom);
      const dw = natural.w * total;
      const dh = natural.h * total;
      const left = (vp.w - dw) / 2 + off.x;
      const top = (vp.h - dh) / 2 + off.y;
      const sx = Math.min(natural.w, Math.max(0, -left / total));
      const sy = Math.min(natural.h, Math.max(0, -top / total));
      const sw = Math.min(natural.w - sx, vp.w / total);
      const sh = Math.min(natural.h - sy, vp.h / total);
      const outW = kind === "avatar" ? 512 : 1280;
      const outH = kind === "avatar" ? 512 : 420;
      const c = document.createElement("canvas");
      c.width = outW;
      c.height = outH;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Could not process this image");
      ctx.fillStyle = "#0d1f17"; // deep green backdrop for transparent images
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      onDone(c.toDataURL("image/jpeg", 0.82));
    } catch (e: any) {
      toast(e?.message ?? "Could not crop that image", "error");
    } finally {
      setBusy(false);
    }
  };

  const show = Boolean(url && natural && vp && boxRef.current);
  const scale = scaleFor(zoom);

  return (
    <Modal open onClose={onCancel}>
      <div className="p-6 sm:p-8">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Crop size={18} className="text-flag-green" />
          {kind === "avatar" ? "Position your profile photo" : "Position your cover photo"}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-fg/50">
          Drag the photo to frame it, then zoom. The visible area is exactly what gets saved.
        </p>

        {/* Hidden loader — reports the image's real dimensions */}
        {url && !natural && (
          <img
            src={url}
            alt=""
            className="hidden"
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth > 0) setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
        )}

        <div
          ref={boxRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={cn(
            "relative mx-auto mt-5 w-full touch-none select-none overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10",
            show ? "cursor-grab active:cursor-grabbing" : "",
          )}
          style={{
            aspectRatio: `${aspect}`,
            maxWidth: kind === "avatar" ? 300 : undefined,
          }}
        >
          {show && natural && vp && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: natural.w * scale,
                height: natural.h * scale,
                left: (vp.w - natural.w * scale) / 2 + off.x,
                top: (vp.h - natural.h * scale) / 2 + off.y,
              }}
            />
          )}
          {/* Rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
          </div>
        </div>

        {natural && vp && (
          <div className="mx-auto mt-4 flex max-w-xs items-center gap-3">
            <ZoomIn size={15} className="shrink-0 text-fg/40" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#CE1126]"
              aria-label="Zoom"
            />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setZoom(1);
              setOff({ x: 0, y: 0 });
            }}
            disabled={busy}
          >
            <RotateCcw size={14} /> Reset
          </Button>
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="gold" className="flex-1" onClick={confirm} disabled={busy || !natural || !vp}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Crop size={15} />}
            {busy ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* About & details — the member's own editable profile information.    */
/* ------------------------------------------------------------------ */

function ProfileEditor({ member }: { member: PublicMember }) {
  const { toast, setUser } = useStore();
  const tanQuery = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    bio: "",
    profession: "",
    hometown: "",
    church: "",
    diasporaCountry: "",
  });

  const start = () => {
    setDraft({
      bio: member.bio ?? "",
      profession: member.profession ?? "",
      hometown: member.hometown ?? "",
      church: member.church ?? "",
      diasporaCountry: member.diasporaCountry ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const patch = {
        bio: draft.bio.trim(),
        profession: draft.profession.trim(),
        hometown: draft.hometown.trim(),
        church: draft.church.trim(),
        diasporaCountry: draft.diasporaCountry.trim(),
      };
      const updated = await rpcClient.members.update({ id: member.id, patch });
      setUser(updated);
      tanQuery.invalidateQueries({ queryKey: ["members", "byId", member.id] });
      setOpen(false);
      toast("Profile updated 🇬🇭");
    } catch (e: any) {
      toast(e?.message ?? "Failed to save", "error");
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    { icon: Briefcase, label: "Profession", value: member.profession },
    { icon: MapPin, label: "Hometown", value: member.hometown },
    { icon: Church, label: "Church / denomination", value: member.church },
    { icon: Globe, label: "Diaspora country", value: member.diasporaCountry },
  ].filter((r) => r.value);

  const inputCls =
    "w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/10";

  return (
    <div className="mt-5 rounded-2xl border border-fg/10 bg-soft/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
          <Home size={13} className="text-flag-red" /> About & details
        </p>
        {!open && (
          <button
            onClick={start}
            className="inline-flex items-center gap-1.5 rounded-full border border-fg/15 px-3 py-1.5 text-xs font-bold text-fg/70 hover:border-flag-green hover:text-flag-green transition-colors cursor-pointer"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/45">About me</label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={3}
              maxLength={400}
              placeholder="A few words about who you are, what you care about, or what you'd like to contribute to Ghana…"
              className={inputCls}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/45">Profession</label>
              <input value={draft.profession} onChange={(e) => setDraft({ ...draft, profession: e.target.value })} placeholder="e.g. Teacher, nurse, trader…" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/45">Hometown</label>
              <input value={draft.hometown} onChange={(e) => setDraft({ ...draft, hometown: e.target.value })} placeholder="e.g. Kumasi" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/45">Church / denomination</label>
              <input value={draft.church} onChange={(e) => setDraft({ ...draft, church: e.target.value })} placeholder="Optional" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/45">Diaspora country</label>
              <input value={draft.diasporaCountry} onChange={(e) => setDraft({ ...draft, diasporaCountry: e.target.value })} placeholder="e.g. USA, UK…" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" className="px-4 py-2 text-xs" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="gold" className="px-4 py-2 text-xs" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {member.bio ? (
            <p className="text-sm leading-relaxed text-fg/65">{member.bio}</p>
          ) : (
            <p className="text-[13px] italic text-fg/40">Nothing added yet — tap Edit to tell the circle a little about you.</p>
          )}
          {rows.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <Chip key={r.label} tone="sand" className="px-2.5 py-1 text-[11px]">
                  <r.icon size={11} className="text-flag-red" /> {r.value}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-fg/40">
        Region, hometown &amp; profession visibility follow the “What others can see” switches below.
      </p>
    </div>
  );
}

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, toast, refresh, setUser } = useStore();
  const [photoBusy, setPhotoBusy] = useState<"avatar" | "cover" | null>(null);
  const [crop, setCrop] = useState<{ kind: "avatar" | "cover"; file: File } | null>(null);

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

  const uploadPhoto = async (kind: "avatar" | "cover", data: string) => {
    if (!user) return;
    setPhotoBusy(kind);
    try {
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

  // Pick → crop → upload: choosing a file opens the crop step first.
  const onPickPhoto = (kind: "avatar" | "cover", file?: File | null) => {
    if (!file || !user) return;
    setCrop({ kind, file });
  };

  const onCropDone = (kind: "avatar" | "cover", data: string) => {
    setCrop(null);
    void uploadPhoto(kind, data);
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
    <>
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

          <ProfileEditor member={member} />

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

      {/* Crop step — opens above the profile when a photo is picked */}
      {crop && (
        <CropModal
          kind={crop.kind}
          file={crop.file}
          onCancel={() => setCrop(null)}
          onDone={(data) => onCropDone(crop.kind, data)}
        />
      )}
    </>
  );
}
