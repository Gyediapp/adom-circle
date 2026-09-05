import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Users,
  FolderKanban,
  MessageSquareWarning,
  Settings as SettingsIcon,
  Trash2,
  Pin,
  PinOff,
  Plus,
  Loader2,
  Megaphone,
  CheckCircle2,
  XCircle,
  Star,
  Eye,
  Image as ImageIcon,
  CalendarDays,
  Crown,
  Trophy,
  Mail,
  MailOpen,
  Pencil,
  ShieldBan,
  ShieldCheck,
  BadgeCheck,
  Check,
  Database,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, Toggle, Avatar, Modal } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { DeepSeekRateCard, DeepSeekStatusPill } from "./deepseek-card";
import { captchaConfigured } from "@/client/lib/captcha";
import { cn, timeAgo, isOnline, presenceLabel } from "@/client/lib/format";
import { GHANA_REGIONS } from "@/server/data/regions";
import { MdEditor } from "./md-editor";
import type { Settings, Post } from "@/server/rpc/site";
import type { PublicMember } from "@/server/rpc/members";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Site content", icon: FileText },
  { id: "members", label: "Members & roles", icon: Users },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "events", label: "Events & Ads", icon: CalendarDays },
  { id: "posts", label: "Posts & stories", icon: Megaphone },
  { id: "mailbox", label: "Mailbox", icon: Mail },
  { id: "moderation", label: "Moderation", icon: MessageSquareWarning },
] as const;

type AdminTab = (typeof TABS)[number]["id"];

export function Admin() {
  const { user, toast } = useStore();
  const [tab, setTab] = useState<AdminTab>("overview");

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 pt-40 pb-20 text-center">
        <p className="font-display text-2xl font-bold">Admin access required</p>
        <p className="mt-2 text-sm text-fg/55">Sign in with an admin account to manage the site.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-36 pb-20 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
            <SettingsIcon size={14} /> Admin panel
          </p>
          <h1 className="font-display text-4xl font-bold">Manage the Circle</h1>
        </div>
        <Chip tone="green"><Star size={13} /> Signed in as {user.name}</Chip>
        <DeepSeekStatusPill />
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
              tab === t.id ? "bg-ink text-cream" : "bg-card border border-fg/10 text-fg/60 hover:text-fg",
            )}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "content" && <ContentManager />}
      {tab === "members" && <MembersManager />}
      {tab === "projects" && <ProjectsManager />}
      {tab === "events" && <EventsManager />}
      {tab === "posts" && <PostsManager />}
      {tab === "mailbox" && <Mailbox />}
      {tab === "moderation" && <ModerationPanel />}
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview() {
  const { user, toast } = useStore();
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const broadcast = useMutation(
    queryClient.notifications.broadcast.mutationOptions({
      onSuccess: (n) => {
        toast(`Broadcast sent to ${n} members 📣`);
        setBroadcastOpen(false);
        setBroadcastTitle("");
        setBroadcastBody("");
      },
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );

  const { data } = useQuery(
    queryClient.admin.overview.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );

  // Storage backend + Supabase → volume migration
  const qc = useQueryClient();
  const [migrateOpen, setMigrateOpen] = useState(false);
  const { data: storage } = useQuery(
    queryClient.admin.storageStatus.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );
  const migrate = useMutation(
    queryClient.admin.migrateStorageToFile.mutationOptions({
      onSuccess: (r) => {
        toast(`Migration complete — ${r.total} items moved to the Railway volume ✅`);
        setMigrateOpen(false);
        qc.invalidateQueries({ queryKey: ["admin", "storageStatus"] });
      },
      onError: (e: any) => toast(e?.message ?? "Migration failed", "error"),
    }),
  );

  if (!data) {
    return (
      <Card className="p-16 text-center text-sm text-fg/45">
        <Loader2 size={20} className="mx-auto mb-3 animate-spin" /> Loading analytics…
      </Card>
    );
  }

  const counts: Array<[string, number, string]> = [
    ["Members", data.counts.members, "text-flag-red"],
    ["Projects", data.counts.projects, "text-flag-green"],
    ["Chat messages", data.counts.messages, "text-fg"],
    ["Forum threads", data.counts.threads, "text-flag-red"],
    ["Open reports", data.counts.openReports, "text-clay"],
    ["Voter pledges", data.counts.pledged, "text-flag-green"],
    ["Diaspora members", data.counts.diaspora, "text-fg"],
    ["Total hours", data.counts.totalHours, "text-flag-green"],
  ];

  return (
    <div className="space-y-6">
      {/* DeepSeek rate tracker — site owner tool */}
      <DeepSeekRateCard />

      {/* Security / bot protection status */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-bold">Bot & spam protection</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-soft/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-flag-green">
              <CheckCircle2 size={14} /> Honeypot
            </p>
            <p className="mt-0.5 text-[11px] text-fg/50">Hidden field traps bots on signup</p>
          </div>
          <div className="rounded-2xl bg-soft/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-flag-green">
              <CheckCircle2 size={14} /> Rate limiting
            </p>
            <p className="mt-0.5 text-[11px] text-fg/50">5 attempts / 15 min per email</p>
          </div>
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              captchaConfigured ? "bg-flag-green/10" : "border border-dashed border-clay/50 bg-gold-soft/25",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-bold",
                captchaConfigured ? "text-flag-green" : "text-clay",
              )}
            >
              <CheckCircle2 size={14} /> reCAPTCHA v3
            </p>
            <p className="mt-0.5 text-[11px] text-fg/55">
              {captchaConfigured
                ? "Active — invisible Google verification on signup"
                : "Demo mode — add VITE_RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY to enable"}
            </p>
          </div>
        </div>
      </Card>

      {/* Email delivery status */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-bold">Email delivery</p>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            data.emailLive ? "bg-flag-green/10" : "border border-dashed border-clay/50 bg-gold-soft/25",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-1.5 text-[13px] font-bold",
              data.emailLive ? "text-flag-green" : "text-clay",
            )}
          >
            <Mail size={14} /> {data.emailLive ? "Resend — live" : "Demo mode (codes shown on screen)"}
          </p>
          <p className="mt-0.5 text-[11px] text-fg/55">
            {data.emailLive
              ? "Verification & reset emails are delivered to real inboxes."
              : "Set RESEND_API_KEY in Railway and redeploy to send real emails."}
          </p>
        </div>
      </Card>

      {/* Storage & data — backend status + Supabase → volume migration */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">Storage & data</p>
          <Chip tone={storage?.backend === "file" ? "green" : "sand"}>
            {storage?.backend === "file" ? (
              <>
                <HardDrive size={11} /> Railway volume (file)
              </>
            ) : (
              <>
                <Database size={11} /> Supabase (cloud)
              </>
            )}
          </Chip>
        </div>

        {storage?.backend === "file" ? (
          <div className="rounded-2xl bg-flag-green/10 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-flag-green">
              <CheckCircle2 size={14} /> Running on the Railway volume
            </p>
            <p className="mt-0.5 text-[11px] text-fg/55">
              Data lives in {storage.storagePath} — no Supabase egress. Supabase env vars are removed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-dashed border-clay/50 bg-gold-soft/25 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-clay">
                <Database size={14} /> Stored in Supabase cloud
              </p>
              <p className="mt-0.5 text-[11px] text-fg/55">
                {storage?.collections.reduce((s, c) => s + c.count, 0) ?? 0} items across{" "}
                {storage?.collections.length ?? 0} collections. Supabase free-tier egress counts against you.
              </p>
            </div>
            <Button variant="dark" className="px-4 py-2 text-xs" onClick={() => setMigrateOpen(true)}>
              <HardDrive size={14} /> Start migration to volume
            </Button>
          </div>
        )}

        {storage?.collections && storage.collections.length > 0 && (
          <div className="mt-3 grid max-h-40 grid-cols-3 gap-x-4 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-4">
            {storage.collections.map((c) => (
              <p key={c.name} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-fg/55">{c.name}</span>
                <span className="font-bold text-fg/75">{c.count}</span>
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* Migration confirm modal */}
      <Modal open={migrateOpen} onClose={() => setMigrateOpen(false)}>
        <div className="p-6 sm:p-8">
          <p className="mb-1 flex items-center gap-2 font-display text-xl font-bold">
            <HardDrive size={18} className="text-flag-green" /> Migrate to the Railway volume
          </p>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-fg/70">
            <p>
              Copies <strong>every collection</strong> from Supabase into the volume mounted at{" "}
              <code className="rounded bg-soft px-1.5 py-0.5 text-[12px] font-bold">/app/.storage</code>.
            </p>
            <p className="rounded-2xl bg-soft/60 px-4 py-3 text-[13px]">
              <strong className="text-flag-green">Safe:</strong> this only <em>reads</em> Supabase — nothing is
              deleted. Your Supabase project stays intact as a backup.
            </p>
            <p className="rounded-2xl bg-soft/60 px-4 py-3 text-[13px]">
              <strong>After it finishes:</strong> remove <code className="rounded bg-ink/10 px-1 font-bold">SUPABASE_URL</code> and{" "}
              <code className="rounded bg-ink/10 px-1 font-bold">SUPABASE_SERVICE_ROLE_KEY</code> from Railway, then redeploy. The site
              then runs entirely on the volume — zero egress cost.
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              variant="dark"
              className="flex-1"
              disabled={migrate.isPending}
              onClick={() => user && migrate.mutate({ adminId: user.id })}
            >
              {migrate.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
              {migrate.isPending ? "Migrating…" : "Start migration"}
            </Button>
            <Button variant="ghost" onClick={() => setMigrateOpen(false)} disabled={migrate.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Broadcast */}
      <Card className="p-5">
        {!broadcastOpen ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold">Notify all members</p>
            <Button variant="dark" className="px-4 py-2 text-xs" onClick={() => setBroadcastOpen(true)}>
              <Megaphone size={14} /> New broadcast
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold">Send a notification to every member</p>
            <input
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Headline — e.g. Volunteer drive this weekend!"
              className="w-full rounded-xl border border-fg/15 bg-card px-4 py-2.5 text-sm outline-none focus:border-flag-red"
            />
            <textarea
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Short message…"
              className="h-20 w-full rounded-xl border border-fg/15 bg-card px-4 py-2.5 text-sm outline-none focus:border-flag-red"
            />
            <div className="flex gap-2">
              <Button
                variant="dark"
                disabled={broadcast.isPending || broadcastTitle.trim().length < 3 || broadcastBody.trim().length < 3}
                onClick={() => user && broadcast.mutate({ adminId: user.id, title: broadcastTitle.trim(), body: broadcastBody.trim() })}
              >
                {broadcast.isPending ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />}
                Send to all
              </Button>
              <Button variant="ghost" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {counts.map(([label, value, color]) => (
          <Card key={label} className="p-5">
            <p className={cn("font-display text-3xl font-bold", color)}>{value.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-fg/45">{label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">Projects by theme</p>
          {data.themes.length === 0 && <p className="text-sm text-fg/45">No projects yet.</p>}
          <div className="space-y-3">
            {data.themes.map((t) => {
              const max = Math.max(...data.themes.map((x) => x.count), 1);
              return (
                <div key={t.theme}>
                  <div className="mb-1 flex justify-between text-[13px] font-semibold">
                    <span>{t.theme}</span>
                    <span className="text-fg/45">{t.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-flag-red via-flag-gold to-flag-green"
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">Members by region</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {GHANA_REGIONS.map((r) => {
              const c = data.regions.find((x) => x.region === r.id)?.count ?? 0;
              const max = Math.max(...data.regions.map((x) => x.count), 1);
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="w-24 truncate text-[12px] font-semibold text-fg/60">{r.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full rounded-full bg-flag-green" style={{ width: `${(c / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[11px] font-bold text-fg/45">{c}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">Most active rooms</p>
          <div className="space-y-2.5">
            {data.roomActivity.slice(0, 6).map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-xl bg-soft/60 px-4 py-2.5">
                <span className="text-sm font-semibold">{r.icon} {r.name}</span>
                <span className="text-[12px] font-bold text-fg/50">{r.messages} msgs · {r.threads} threads</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold">
            <Trophy size={15} className="text-flag-gold" /> Top contributors by rank points
          </p>
          <div className="space-y-2.5">
            {data.topMembers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-soft/60 px-4 py-2.5">
                <span className="font-display text-lg font-bold text-fg/35">#{i + 1}</span>
                <Avatar name={m.name} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight">{m.name}</p>
                  <RankChip points={m.points} role={m.role} />
                </div>
                <span className="text-[12px] font-bold text-flag-green">{m.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Content manager ---------------- */

function ContentManager() {
  const { user, toast } = useStore();
  const { data: settings } = useQuery(queryClient.site.get.queryOptions());
  const [draft, setDraft] = useState<Settings | null>(null);

  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  const save = useMutation(
    queryClient.site.update.mutationOptions({
      onSuccess: () => toast("Site content updated ✨"),
      onError: (e: any) => toast(e?.message ?? "Save failed", "error"),
    }),
  );

  if (!draft) return <Card className="p-16 text-center text-sm text-fg/45"><Loader2 size={20} className="mx-auto mb-3 animate-spin" />Loading…</Card>;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg/55">Edit everything on the public site — hero, stats, values, announcement, footer.</p>
        <Button
          variant="dark"
          onClick={() => user && save.mutate({ adminId: user.id, settings: draft })}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : "Save changes"}
        </Button>
      </div>

      {/* Ticker — scrolling top bar */}
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Scrolling ticker (top of site)</p>
          <Toggle
            checked={draft.ticker?.enabled ?? false}
            onChange={(v) => set("ticker", { ...draft.ticker, enabled: v, text: draft.ticker?.text ?? "" })}
            label="Visible"
          />
        </div>
        <textarea
          value={draft.ticker?.text ?? ""}
          onChange={(e) => set("ticker", { ...draft.ticker, text: e.target.value, enabled: draft.ticker?.enabled ?? false })}
          placeholder="Type your daily civic message here — it scrolls slowly across the top of the site…"
          className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
        />
        <p className="mt-1.5 text-[11px] text-fg/45">Shown above the announcement bar, moves slowly across the top.</p>
      </Card>

      {/* Announcement */}
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Announcement bar</p>
          <Toggle
            checked={draft.announcement.enabled}
            onChange={(v) => set("announcement", { ...draft.announcement, enabled: v })}
            label="Visible"
          />
        </div>
        <textarea
          value={draft.announcement.text}
          onChange={(e) => set("announcement", { ...draft.announcement, text: e.target.value })}
          className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
        />
      </Card>

      {/* Hero */}
      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Hero section</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Badge" value={draft.hero.badge} onChange={(v) => set("hero", { ...draft.hero, badge: v })} />
          <Field label="Highlight word" value={draft.hero.highlight} onChange={(v) => set("hero", { ...draft.hero, highlight: v })} />
          <Field label="Title line" value={draft.hero.title} onChange={(v) => set("hero", { ...draft.hero, title: v })} />
          <Field label="Hero image" value={draft.hero.image} onChange={(v) => set("hero", { ...draft.hero, image: v })} />
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Subtitle</label>
          <textarea
            value={draft.hero.subtitle}
            onChange={(e) => set("hero", { ...draft.hero, subtitle: e.target.value })}
            className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
          />
        </div>
        <ImagePicker value={draft.hero.image} onChange={(v) => set("hero", { ...draft.hero, image: v })} />
      </Card>

      {/* Stats */}
      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Public impact stats</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(["members", "projects", "regions", "hours", "volunteers"] as const).map((k) => (
            <div key={k}>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-fg/50">{k}</label>
              <input
                type="number"
                value={draft.stats[k]}
                onChange={(e) => set("stats", { ...draft.stats, [k]: Number(e.target.value) })}
                className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Social links */}
      <Card className="p-6">
        <p className="mb-1 text-sm font-bold">Social & community links</p>
        <p className="mb-4 text-[12px] text-fg/50">
          Shown at the top of the landing page and in the footer — Facebook, WhatsApp Channel, YouTube, TikTok.
        </p>
        <div className="space-y-3">
          {draft.socials.map((s, i) => (
            <div key={i} className="grid gap-3 rounded-2xl bg-soft/50 p-4 sm:grid-cols-[130px_1fr_1fr_36px]">
              <select
                value={s.platform}
                onChange={(e) => {
                  const socials = [...draft.socials];
                  socials[i] = { ...socials[i], platform: e.target.value as any };
                  set("socials", socials);
                }}
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none cursor-pointer capitalize"
              >
                {["facebook", "whatsapp", "youtube", "tiktok", "other"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                value={s.label}
                onChange={(e) => {
                  const socials = [...draft.socials];
                  socials[i] = { ...socials[i], label: e.target.value };
                  set("socials", socials);
                }}
                placeholder="Label (e.g. WhatsApp Channel)"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red"
              />
              <input
                value={s.url}
                onChange={(e) => {
                  const socials = [...draft.socials];
                  socials[i] = { ...socials[i], url: e.target.value };
                  set("socials", socials);
                }}
                placeholder="https://…"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red"
              />
              <button
                onClick={() => set("socials", draft.socials.filter((_, x) => x !== i))}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              set("socials", [...draft.socials, { platform: "other", label: "New link", url: "" }])
            }
          >
            <Plus size={15} /> Add link
          </Button>
        </div>
      </Card>

      {/* Mission / vision / welcome / footer */}
      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Text content</p>
        <div className="space-y-4">
          <TextAreaField label="Mission" value={draft.mission} onChange={(v) => set("mission", v)} />
          <TextAreaField label="Vision" value={draft.vision} onChange={(v) => set("vision", v)} />
          <TextAreaField label="Welcome message" value={draft.welcome} onChange={(v) => set("welcome", v)} />
          <TextAreaField label="Footer text" value={draft.footer} onChange={(v) => set("footer", v)} />
        </div>
      </Card>

      {/* Values */}
      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Core values</p>
        <div className="space-y-5">
          {draft.values.map((v, i) => (
            <div key={i} className="grid gap-3 rounded-2xl bg-soft/50 p-4 sm:grid-cols-[120px_1fr]">
              <input
                value={v.icon}
                onChange={(e) => {
                  const values = [...draft.values];
                  values[i] = { ...values[i], icon: e.target.value };
                  set("values", values);
                }}
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-xs outline-none"
                placeholder="icon key"
              />
              <div className="space-y-2">
                <input
                  value={v.title}
                  onChange={(e) => {
                    const values = [...draft.values];
                    values[i] = { ...values[i], title: e.target.value };
                    set("values", values);
                  }}
                  className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm font-semibold outline-none"
                />
                <textarea
                  value={v.text}
                  onChange={(e) => {
                    const values = [...draft.values];
                    values[i] = { ...values[i], text: e.target.value };
                    set("values", values);
                  }}
                  className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none"
                />
              </div>
              <button
                onClick={() => set("values", draft.values.filter((_, x) => x !== i))}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              set("values", [...draft.values, { icon: "heart", title: "New value", text: "" }])
            }
          >
            <Plus size={15} /> Add value
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Members ---------------- */

function MembersManager() {
  const { user, toast } = useStore();
  const [q, setQ] = useState("");
  const { data: members } = useQuery(
    queryClient.members.list.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());

  const setRole = useMutation(
    queryClient.members.setRole.mutationOptions({
      onSuccess: () => toast("Role updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const setManaged = useMutation(
    queryClient.members.setManagedRooms.mutationOptions({
      onSuccess: () => toast("Room delegation updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const setPoints = useMutation(
    queryClient.members.setPoints.mutationOptions({
      onSuccess: () => toast("Points updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const setStatus = useMutation(
    queryClient.members.setStatus.mutationOptions({
      onSuccess: (_d, vars) => toast(vars.status === "suspended" ? "Member suspended" : "Member reactivated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const setVerified = useMutation(
    queryClient.members.setVerified.mutationOptions({
      onSuccess: () => toast("Verified business status updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const adminUpdate = useMutation(
    queryClient.members.adminUpdateMember.mutationOptions({
      onSuccess: () => {
        toast("Member profile updated");
        setEditing(null);
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const remove = useMutation(
    queryClient.members.remove.mutationOptions({
      onSuccess: () => toast("Member removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const [editing, setEditing] = useState<PublicMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    hometown: "",
    diasporaCountry: "",
    church: "",
    profession: "",
    bio: "",
  });
  const [confirmRemove, setConfirmRemove] = useState<PublicMember | null>(null);

  const startEdit = (m: PublicMember) => {
    setEditing(m);
    setEditForm({
      name: m.name,
      email: m.email,
      phone: m.phone ?? "",
      region: m.region,
      hometown: m.hometown,
      diasporaCountry: m.diasporaCountry,
      church: m.church,
      profession: m.profession,
      bio: m.bio,
    });
  };

  const filtered = useMemo(
    () => (members ?? []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase())),
    [members, q],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-fg/8 p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members…"
          className="flex-1 min-w-[180px] rounded-xl border border-fg/12 bg-card px-4 py-2 text-sm outline-none focus:border-flag-red"
        />
        <Chip tone="green">{filtered.length} members</Chip>
        <Chip tone="gold"><Crown size={11} /> VIPs: {members?.filter((m) => m.role === "vip").length ?? 0}</Chip>
      </div>
      <div className="divide-y divide-fg/5">
        {filtered.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <Avatar name={m.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{m.name}</p>
                <RankChip points={m.points} role={m.role} size="md" />
                <span className="text-[11px] font-bold text-fg/40">{m.points.toLocaleString()} pts</span>
                {(m as any).status === "suspended" && (
                  <Chip tone="red" className="px-2 py-0.5 text-[10px] uppercase">
                    <ShieldBan size={10} /> Suspended
                  </Chip>
                )}
                {(m as any).verified && (
                  <Chip tone="green" className="px-2 py-0.5 text-[10px] uppercase">
                    <CheckCircle2 size={10} /> Verified
                  </Chip>
                )}
              </div>
              <p className="truncate text-[12px] text-fg/45">
                {m.email} · {GHANA_REGIONS.find((r) => r.id === m.region)?.name ?? m.region}
                {m.diasporaCountry ? ` · diaspora: ${m.diasporaCountry}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-fg/45">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={11} className="text-flag-red" />
                  Joined {new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isOnline((m as any).lastSeenAt) ? "bg-flag-green" : "bg-fg/25",
                    )}
                  />
                  {presenceLabel((m as any).lastSeenAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.badges.slice(0, 3).map((b) => (
                  <Chip key={b} tone="sand" className="px-2 py-0.5 text-[10px]">{b}</Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={m.role}
                onChange={(e) => user && setRole.mutate({ adminId: user.id, memberId: m.id, role: e.target.value as any })}
                className="rounded-xl border border-fg/15 bg-card px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer capitalize"
              >
                {["member", "vip", "moderator", "admin", "partner"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                defaultValue={m.points}
                onBlur={(e) => {
                  const pts = Number(e.target.value);
                  if (pts !== m.points) {
                    user && setPoints.mutate({ adminId: user.id, memberId: m.id, points: pts });
                  }
                }}
                className="w-20 rounded-xl border border-fg/15 bg-card px-2 py-1.5 text-xs outline-none focus:border-flag-gold"
                title="Points"
              />
              <button
                onClick={() =>
                  user &&
                  setVerified.mutate({
                    adminId: user.id,
                    memberId: m.id,
                    verified: !(m as any).verified,
                    merchantName: (m as any).merchantName || (m as any).name,
                  })
                }
                className={cn(
                  "rounded-full p-2 cursor-pointer",
                  (m as any).verified
                    ? "text-flag-green hover:bg-flag-green/10"
                    : "text-fg/30 hover:text-flag-green hover:bg-flag-green/10",
                )}
                title={(m as any).verified ? "Remove verified business badge" : "Mark as verified business"}
              >
                <BadgeCheck size={15} />
              </button>
              <button
                onClick={() => startEdit(m)}
                className="rounded-full p-2 text-fg/30 hover:text-flag-green hover:bg-flag-green/5 cursor-pointer"
                title="Edit member profile"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() =>
                  user &&
                  setStatus.mutate({
                    adminId: user.id,
                    memberId: m.id,
                    status: (m as any).status === "suspended" ? "active" : "suspended",
                  })
                }
                className={`rounded-full p-2 cursor-pointer ${
                  (m as any).status === "suspended"
                    ? "text-flag-green hover:bg-flag-green/10"
                    : "text-fg/30 hover:text-clay hover:bg-flag-gold/10"
                }`}
                title={(m as any).status === "suspended" ? "Reactivate member" : "Suspend member"}
              >
                {(m as any).status === "suspended" ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}
              </button>
              <button
                onClick={() => setConfirmRemove(m)}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                title="Delete member (permanently)"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {m.role === "moderator" && (
              <div className="lg:w-64">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg/40">Manages rooms</p>
                <div className="flex flex-wrap gap-1.5">
                  {(rooms ?? []).map((r) => {
                    const checked = m.managedRooms.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (!user) return;
                          const next = checked
                            ? m.managedRooms.filter((id) => id !== r.id)
                            : [...m.managedRooms, r.id];
                          setManaged.mutate({ adminId: user.id, memberId: m.id, rooms: next });
                        }}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer",
                          checked
                            ? "border-flag-green bg-flag-green text-cream"
                            : "border-fg/15 bg-card text-fg/50 hover:border-flag-green",
                        )}
                        title={r.name}
                      >
                        {r.icon} {r.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="p-10 text-center text-sm text-fg/45">No members found.</p>}
      </div>

      {/* Edit member modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} wide>
        {editing && (
          <div className="p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={editing.name} size={42} />
              <div>
                <p className="font-display text-xl font-bold">{editing.name}</p>
                <p className="text-sm text-fg/50">
                  {editing.email} · {editing.points.toLocaleString()} pts
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ModalField label="Full name">
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Email">
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Phone">
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Region">
                <select
                  value={editForm.region}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  className={inputCls}
                >
                  {GHANA_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="Hometown">
                <input value={editForm.hometown} onChange={(e) => setEditForm({ ...editForm, hometown: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Diaspora country">
                <input value={editForm.diasporaCountry} onChange={(e) => setEditForm({ ...editForm, diasporaCountry: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Church / denomination">
                <input value={editForm.church} onChange={(e) => setEditForm({ ...editForm, church: e.target.value })} className={inputCls} />
              </ModalField>
              <ModalField label="Profession">
                <input value={editForm.profession} onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })} className={inputCls} />
              </ModalField>
              <div className="sm:col-span-2">
                <ModalField label="Bio">
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={3}
                    className={inputCls}
                  />
                </ModalField>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="gold"
                onClick={() =>
                  user &&
                  editing &&
                  adminUpdate.mutate({
                    adminId: user.id,
                    memberId: editing.id,
                    patch: {
                      name: editForm.name,
                      email: editForm.email,
                      phone: editForm.phone || null,
                      region: editForm.region,
                      hometown: editForm.hometown,
                      diasporaCountry: editForm.diasporaCountry,
                      church: editForm.church,
                      profession: editForm.profession,
                      bio: editForm.bio,
                    },
                  })
                }
                disabled={adminUpdate.isPending}
              >
                {adminUpdate.isPending ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={15} />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete member confirmation */}
      <Modal open={!!confirmRemove} onClose={() => setConfirmRemove(null)}>
        <div className="p-6 sm:p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-flag-red/10 text-flag-red">
            <Trash2 size={24} />
          </span>
          <p className="font-display text-xl font-bold">Delete this member?</p>
          <p className="mt-2 text-sm leading-relaxed text-fg/60">
            <strong className="text-fg">{confirmRemove?.name}</strong> ({confirmRemove?.email}) will be
            permanently removed — account, sessions, notifications and DMs. Their chat messages will be
            anonymised, and the email can be used to sign up again immediately.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={remove.isPending}
              onClick={() => {
                if (!user || !confirmRemove) return;
                remove.mutate({ adminId: user.id, memberId: confirmRemove.id });
                setConfirmRemove(null);
              }}
            >
              {remove.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={15} />}
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

const inputCls =
  "w-full rounded-xl border border-fg/15 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15";

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-fg/50">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- Projects ---------------- */

function ProjectsManager() {
  const { user, toast } = useStore();
  const { data: projects } = useQuery(queryClient.projects.liveProjects.list.experimental_liveOptions());

  const setStatus = useMutation(
    queryClient.projects.setStatus.mutationOptions({
      onSuccess: () => toast("Project status updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const remove = useMutation(
    queryClient.projects.removeProject.mutationOptions({
      onSuccess: () => toast("Project removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  return (
    <div className="space-y-4">
      {projects?.map((p) => (
        <Card key={p.id} className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <img src={p.image} alt="" className="h-16 w-24 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{p.title}</p>
              <p className="text-[12px] text-fg/45">
                {p.theme} · {p.location} · submitted by {p.submittedBy} · {p.volunteers} volunteers · {p.hours} hrs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={p.status}
                onChange={(e) => user && setStatus.mutate({ adminId: user.id, projectId: p.id, status: e.target.value as any })}
                className="rounded-xl border border-fg/15 bg-card px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer capitalize"
              >
                {["planned", "ongoing", "completed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => user && remove.mutate({ adminId: user.id, projectId: p.id })}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </Card>
      ))}
      {(!projects || projects.length === 0) && <Card className="p-10 text-center text-sm text-fg/45">No projects yet.</Card>}
    </div>
  );
}

/* ---------------- Posts ---------------- */

function PostsManager() {
  const { user, toast } = useStore();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["posts", "list"] });
  const { data: posts } = useQuery(queryClient.posts.list.queryOptions());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("News");
  const [author, setAuthor] = useState(user?.name ?? "");
  const [image, setImage] = useState("/output/images/hero.jpg");
  const [featured, setFeatured] = useState(false);

  // Open the form for a new post (blank) or an existing one (pre-filled)
  const openForm = (p?: Post) => {
    setEditing(p ?? null);
    setTitle(p?.title ?? "");
    setBody(p?.body ?? "");
    setCategory(p?.category ?? "News");
    setAuthor(p?.author ?? user?.name ?? "");
    setImage(p?.image ?? "/output/images/hero.jpg");
    setFeatured(p?.featured ?? false);
    setOpen(true);
  };

  const create = useMutation(
    queryClient.posts.create.mutationOptions({
      onSuccess: () => {
        toast("Post published 📣");
        setOpen(false);
        refresh();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const update = useMutation(
    queryClient.posts.update.mutationOptions({
      onSuccess: () => {
        toast("Post updated ✏️");
        setOpen(false);
        refresh();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const toggle = useMutation(
    queryClient.posts.toggleFeatured.mutationOptions({
      onSuccess: () => {
        toast("Featured updated");
        refresh();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const remove = useMutation(
    queryClient.posts.remove.mutationOptions({
      onSuccess: () => {
        toast("Post removed");
        refresh();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  const canSave = title.trim().length >= 3 && body.trim().length >= 10 && !create.isPending && !update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg/55">Publish news, stories, civic & economy content to the site.</p>
        <Button variant="dark" onClick={() => openForm()}><Plus size={15} /> New post</Button>
      </div>

      {posts?.map((p) => (
        <Card key={p.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <img src={p.image} alt="" className="h-16 w-24 rounded-xl object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{p.title}</p>
            <p className="text-[12px] text-fg/45">{p.category} · by {p.author} · {timeAgo(p.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => user && openForm(p)}
              className="rounded-full p-2 text-fg/30 hover:text-flag-green hover:bg-flag-green/5 cursor-pointer"
              title="Edit post"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => user && toggle.mutate({ adminId: user.id, postId: p.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                p.featured ? "bg-flag-gold text-fg" : "bg-soft text-fg/55 hover:text-clay",
              )}
            >
              <Star size={12} /> {p.featured ? "Featured" : "Feature"}
            </button>
            <button
              onClick={() => user && remove.mutate({ adminId: user.id, postId: p.id })}
              className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
              title="Delete post"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </Card>
      ))}

      {open && (
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">{editing ? "Edit post" : "New post"}</p>
          <div className="space-y-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm font-semibold outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15" />
            <MdEditor value={body} onChange={setBody} placeholder="Write the story… **bold**, *italics*, ## headings, lists and links all work." rows={7} />
            <div className="grid gap-4 sm:grid-cols-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none cursor-pointer">
                {["News", "Story", "Civic", "Economy", "Values"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author"
                className="rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red" />
              <Toggle checked={featured} onChange={setFeatured} label="Featured" />
            </div>
            <ImagePicker value={image} onChange={setImage} />
            <div className="flex items-center gap-2">
              <Button
                variant="dark"
                className="w-full py-3"
                disabled={!canSave}
                onClick={() => {
                  if (!user) return;
                  const post = { title: title.trim(), body: body.trim(), category: category as Post["category"], author, image, featured };
                  if (editing) update.mutate({ adminId: user.id, postId: editing.id, post });
                  else create.mutate({ adminId: user.id, post });
                }}
              >
                {(create.isPending || update.isPending) ? <Loader2 size={16} className="animate-spin" /> : (editing ? "Save changes" : "Publish post")}
              </Button>
              <Button variant="ghost" className="px-5 py-3" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Moderation ---------------- */

function ModerationPanel() {
  const { user, toast } = useStore();
  const qc = useQueryClient();
  const refreshRooms = () => qc.invalidateQueries({ queryKey: ["community", "getRooms"] });
  const { data: reports } = useQuery(
    queryClient.community.getReports.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { data: suggestions } = useQuery(
    queryClient.suggestions.adminList.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );
  const { data: overview } = useQuery(
    queryClient.admin.overview.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );

  const resolve = useMutation(
    queryClient.community.resolveReport.mutationOptions({
      onSuccess: () => toast("Report updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const pinRoom = useMutation(
    queryClient.community.togglePinRoom.mutationOptions({
      onSuccess: () => {
        toast("Room updated");
        refreshRooms();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const removeRoom = useMutation(
    queryClient.community.removeRoom.mutationOptions({
      onSuccess: () => {
        toast("Room removed");
        refreshRooms();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const setRoomFeature = useMutation(
    queryClient.community.setRoomFeature.mutationOptions({
      onSuccess: () => {
        toast("Room feature updated");
        refreshRooms();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const updateRoom = useMutation(
    queryClient.community.updateRoom.mutationOptions({
      onSuccess: () => {
        toast("Room updated ✏️");
        setEditingId(null);
        refreshRooms();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const moderateSuggestion = useMutation(
    queryClient.suggestions.moderate.mutationOptions({
      onSuccess: () => toast("Suggestion updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const removeSuggestion = useMutation(
    queryClient.suggestions.remove.mutationOptions({
      onSuccess: () => toast("Suggestion removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const createRoom = useMutation(
    queryClient.community.createRoom.mutationOptions({
      onSuccess: () => {
        toast("Room created 🎉");
        refreshRooms();
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  const [newRoom, setNewRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomIcon, setRoomIcon] = useState("💬");
  // Editing an existing room — name/description/icon can be changed in place
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editMax, setEditMax] = useState("");

  return (
    <div className="space-y-6">
      {/* Reports */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-fg/8 p-4">
          <p className="text-sm font-bold">Reports ({reports?.filter((r) => r.status === "open").length ?? 0} open)</p>
          <div className="flex items-center gap-2">
            <Chip tone={overview?.aiModerationLive ? "green" : "sand"}>
              {overview?.aiModerationLive ? "AI moderation on" : "Local filter only"}
            </Chip>
            <Chip tone={overview && overview.counts.openReports > 0 ? "red" : "green"}>
              {overview && overview.counts.openReports > 0 ? `${overview.counts.openReports} need review` : "All clear"}
            </Chip>
          </div>
        </div>
        <div className="divide-y divide-fg/5">
          {(reports ?? []).slice(0, 10).map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-bold">
                  <Chip tone={r.status === "open" ? "red" : "green"} className="mr-2 capitalize">{r.status}</Chip>
                  {r.targetLabel}
                </p>
                <p className="mt-0.5 text-[12px] text-fg/50">{r.reason} — reported by {r.reporter} · {timeAgo(r.createdAt)}</p>
              </div>
              {r.status === "open" && (
                <div className="flex gap-2">
                  <Button variant="dark" className="px-3 py-1.5 text-xs" onClick={() => user && resolve.mutate({ adminId: user.id, reportId: r.id, status: "resolved" })}>
                    <CheckCircle2 size={13} /> Resolve
                  </Button>
                  <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => user && resolve.mutate({ adminId: user.id, reportId: r.id, status: "dismissed" })}>
                    <XCircle size={13} /> Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
          {(reports ?? []).length === 0 && <p className="p-10 text-center text-sm text-fg/45">No reports yet — the circle is peaceful. 🕊️</p>}
        </div>
      </Card>

      {/* Rooms */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-fg/8 p-4">
          <p className="text-sm font-bold">Chatrooms</p>
          <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setNewRoom(!newRoom)}>
            <Plus size={13} /> New room
          </Button>
        </div>
        {newRoom && (
          <div className="space-y-3 border-b border-fg/8 bg-soft/40 p-4">
            <div className="grid gap-3 sm:grid-cols-[70px_1fr_1fr]">
              <input value={roomIcon} onChange={(e) => setRoomIcon(e.target.value)} className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-center text-lg outline-none" />
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Room name" className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm font-semibold outline-none" />
              <input value={roomDesc} onChange={(e) => setRoomDesc(e.target.value)} placeholder="Short description" className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none" />
            </div>
            <Button
              variant="dark"
              className="text-xs px-4 py-2"
              disabled={roomName.trim().length < 2}
              onClick={() => {
                if (!user) return;
                createRoom.mutate({
                  adminId: user.id,
                  name: roomName.trim(),
                  description: roomDesc.trim() || "A new room in the circle",
                  icon: roomIcon || "💬",
                  color: "#0d1f17",
                });
                setRoomName("");
                setRoomDesc("");
                setNewRoom(false);
              }}
            >
              Create room
            </Button>
          </div>
        )}
        <div className="divide-y divide-fg/5">
          {rooms?.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <span className="text-xl">{r.icon}</span>
              {editingId === r.id ? (
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="w-12 rounded-xl border border-fg/15 bg-card px-2 py-1.5 text-center text-lg outline-none"
                    />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Room name"
                      className="flex-1 rounded-xl border border-flag-gold/50 bg-card px-3 py-1.5 text-sm font-semibold outline-none focus:border-flag-gold"
                    />
                  </div>
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Short description"
                    className="w-full rounded-xl border border-fg/15 bg-card px-3 py-1.5 text-sm outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={editMax}
                      onChange={(e) => setEditMax(e.target.value)}
                      type="number"
                      min={0}
                      placeholder="Max people (blank = no limit)"
                      className="flex-1 rounded-xl border border-fg/15 bg-card px-3 py-1.5 text-sm outline-none"
                    />
                    <span className="text-[11px] font-semibold text-fg/40">0 or blank = unlimited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="dark"
                      className="px-4 py-1.5 text-xs"
                      disabled={updateRoom.isPending || editName.trim().length < 2}
                      onClick={() =>
                        user &&
                        updateRoom.mutate({
                          adminId: user.id,
                          roomId: r.id,
                          name: editName.trim(),
                          description: editDesc.trim(),
                          icon: editIcon.trim(),
                          maxUsers: editMax.trim() === "" ? null : Math.max(0, Number(editMax) || 0),
                        })
                      }
                    >
                      {updateRoom.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save
                    </Button>
                    <Button variant="ghost" className="px-4 py-1.5 text-xs" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{r.name} {r.pinned && <Pin size={11} className="inline text-flag-red" />}</p>
                  <p className="truncate text-[12px] text-fg/45">{r.description} · {r.messageCount} messages
                    {r.maxUsers ? ` · max ${r.maxUsers} people` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(["polls", "kanban", "anonymous"] as const).map((f) => {
                      const on = (r.features ?? []).includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() =>
                            user &&
                            setRoomFeature.mutate({ adminId: user.id, roomId: r.id, feature: f, enabled: !on })
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer",
                            on
                              ? "border-flag-green bg-flag-green text-cream"
                              : "border-fg/15 bg-card text-fg/45 hover:border-flag-green",
                          )}
                          title={`${on ? "Disable" : "Enable"} ${f}`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setEditingId(r.id);
                  setEditName(r.name);
                  setEditDesc(r.description);
                  setEditIcon(r.icon);
                  setEditMax(r.maxUsers ? String(r.maxUsers) : "");
                }}
                className="rounded-full p-2 text-fg/30 hover:text-flag-green hover:bg-flag-green/5 cursor-pointer"
                title="Edit room"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => user && pinRoom.mutate({ adminId: user.id, roomId: r.id })}
                className={cn("rounded-full p-2 cursor-pointer", r.pinned ? "text-flag-red bg-flag-red/8" : "text-fg/30 hover:text-fg")}
                title={r.pinned ? "Unpin" : "Pin"}
              >
                {r.pinned ? <Pin size={15} /> : <PinOff size={15} />}
              </button>
              <button
                onClick={() => user && removeRoom.mutate({ adminId: user.id, roomId: r.id })}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                title="Delete room"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Voice for Ghana — moderation */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-fg/8 p-4">
          <p className="text-sm font-bold">Voice for Ghana — suggestions</p>
          <Chip tone="gold"><Megaphone size={11} /> {suggestions?.filter((s) => s.status === "pending").length ?? 0} pending</Chip>
        </div>
        <div className="divide-y divide-fg/5">
          {(suggestions ?? []).slice(0, 12).map((s) => (
            <div key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-[13px] leading-snug">“{s.text}”</p>
                <p className="mt-1 text-[11px] text-fg/45">
                  {s.authorName} · {s.upvotes.length} upvotes ·{" "}
                  <span className="capitalize">{s.status}</span>
                  {s.featured && " · featured"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.status !== "approved" && (
                  <Button
                    variant="dark"
                    className="rounded-full px-3 py-1 text-xs"
                    onClick={() => user && moderateSuggestion.mutate({ adminId: user.id, suggestionId: s.id, status: "approved" })}
                  >
                    Approve
                  </Button>
                )}
                {s.status !== "rejected" && (
                  <Button
                    variant="ghost"
                    className="rounded-full px-3 py-1 text-xs"
                    onClick={() => user && moderateSuggestion.mutate({ adminId: user.id, suggestionId: s.id, status: "rejected" })}
                  >
                    Reject
                  </Button>
                )}
                <button
                  onClick={() =>
                    user &&
                    moderateSuggestion.mutate({
                      adminId: user.id,
                      suggestionId: s.id,
                      status: s.status,
                      featured: !s.featured,
                    })
                  }
                  className={cn(
                    "rounded-full p-2 cursor-pointer",
                    s.featured ? "text-flag-gold" : "text-fg/30 hover:text-flag-gold",
                  )}
                  title={s.featured ? "Unfeature" : "Feature"}
                >
                  <Star size={15} />
                </button>
                <button
                  onClick={() => user && removeSuggestion.mutate({ adminId: user.id, suggestionId: s.id })}
                  className="rounded-full p-2 text-fg/30 hover:text-flag-red cursor-pointer"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {(!suggestions || suggestions.length === 0) && (
            <p className="p-8 text-center text-sm text-fg/45">No suggestions yet.</p>
          )}
        </div>
      </Card>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">Latest chat messages</p>
          <div className="space-y-3">
            {overview?.recentMessages.slice(0, 6).map((m) => (
              <div key={m.id} className="rounded-xl bg-soft/60 px-4 py-2.5">
                <p className="text-[13px] leading-snug">{m.text}</p>
                <p className="mt-0.5 text-[11px] text-fg/45">{m.authorName} · {timeAgo(m.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">Latest threads</p>
          <div className="space-y-3">
            {overview?.recentThreads.slice(0, 6).map((t) => (
              <div key={t.id} className="rounded-xl bg-soft/60 px-4 py-2.5">
                <p className="text-[13px] font-bold leading-snug">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-fg/45">{t.authorName} · {t.likes} likes · {timeAgo(t.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Events & Ads ---------------- */

function EventsManager() {
  const { user, toast } = useStore();
  const { data: events } = useQuery(queryClient.events.list.queryOptions());
  const { data: ads } = useQuery(
    queryClient.events.adsAll.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );

  const toggleEvent = useMutation(
    queryClient.events.toggleFeatured.mutationOptions({
      onSuccess: () => toast("Event updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const removeEvent = useMutation(
    queryClient.events.remove.mutationOptions({
      onSuccess: () => toast("Event removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const toggleAd = useMutation(
    queryClient.events.adToggle.mutationOptions({
      onSuccess: () => toast("Showcase updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const removeAd = useMutation(
    queryClient.events.adRemove.mutationOptions({
      onSuccess: () => toast("Ad removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const createAd = useMutation(
    queryClient.events.adCreate.mutationOptions({
      onSuccess: () => toast("Ad created 📣"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  const [showAdForm, setShowAdForm] = useState(false);
  const [adTitle, setAdTitle] = useState("");
  const [adTagline, setAdTagline] = useState("");
  const [adImage, setAdImage] = useState("/output/images/economy.jpg");
  const [adLink, setAdLink] = useState("#");
  const [adSponsor, setAdSponsor] = useState("");
  const [adPlacement, setAdPlacement] = useState("home");

  return (
    <div className="space-y-8">
      {/* Events */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Events & activities ({events?.length ?? 0})</p>
          <p className="text-[12px] text-fg/45">Events are created by VIP/moderator/admin members from the Events page.</p>
        </div>
        <div className="space-y-3">
          {events?.map((e) => {
            const d = new Date(e.date);
            return (
              <Card key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-cream">
                  <span className="font-display text-base font-bold">{d.getDate()}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-flag-gold">
                    {d.toLocaleDateString("en-GB", { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{e.title}</p>
                  <p className="text-[12px] text-fg/45">
                    {e.category} · {e.location} · {e.attendeeCount} attending · by {e.organizer}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => user && toggleEvent.mutate({ adminId: user.id, eventId: e.id })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                      e.featured ? "bg-flag-gold text-fg" : "bg-soft text-fg/55 hover:text-clay",
                    )}
                  >
                    <Star size={12} /> {e.featured ? "Featured" : "Feature"}
                  </button>
                  <button
                    onClick={() => user && removeEvent.mutate({ adminId: user.id, eventId: e.id })}
                    className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
          {(!events || events.length === 0) && (
            <Card className="p-10 text-center text-sm text-fg/45">No events yet.</Card>
          )}
        </div>
      </div>

      {/* Ads */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Showcase ads ({ads?.length ?? 0})</p>
          <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setShowAdForm(!showAdForm)}>
            <Plus size={13} /> New ad
          </Button>
        </div>

        {showAdForm && (
          <Card className="mb-4 p-5">
            <p className="mb-3 text-sm font-bold">Create showcase ad</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={adTitle} onChange={(e) => setAdTitle(e.target.value)} placeholder="Ad title"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red" />
              <input value={adSponsor} onChange={(e) => setAdSponsor(e.target.value)} placeholder="Sponsor (e.g. Member business)"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red" />
              <input value={adTagline} onChange={(e) => setAdTagline(e.target.value)} placeholder="One-line tagline"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red" />
              <input value={adLink} onChange={(e) => setAdLink(e.target.value)} placeholder="Link (https://…)"
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red" />
              <select value={adPlacement} onChange={(e) => setAdPlacement(e.target.value)}
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none cursor-pointer">
                <option value="home">Home page</option>
                <option value="events">Events page</option>
                <option value="both">Both</option>
              </select>
              <select value={adImage} onChange={(e) => setAdImage(e.target.value)}
                className="rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none cursor-pointer">
                {IMAGE_CHOICES.map((i) => <option key={i} value={i}>{i.split("/").pop()}</option>)}
              </select>
            </div>
            <Button
              variant="dark"
              className="mt-3"
              disabled={createAd.isPending || adTitle.trim().length < 3}
              onClick={() => {
                if (!user) return;
                createAd.mutate({
                  adminId: user.id,
                  ad: {
                    title: adTitle.trim(),
                    tagline: adTagline.trim() || "Supported by our partners.",
                    image: adImage,
                    link: adLink || "#",
                    sponsor: adSponsor.trim() || "Partner",
                    placement: adPlacement as any,
                    active: true,
                  },
                });
                setShowAdForm(false);
                setAdTitle("");
                setAdTagline("");
              }}
            >
              {createAd.isPending ? <Loader2 size={15} className="animate-spin" /> : "Publish ad"}
            </Button>
          </Card>
        )}

        <div className="space-y-3">
          {ads?.map((ad) => (
            <Card key={ad.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <img src={ad.image} alt="" className="h-14 w-24 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{ad.title}</p>
                <p className="text-[12px] text-fg/45">
                  {ad.sponsor} · {ad.placement} · {ad.clicks} clicks
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => user && toggleAd.mutate({ adminId: user.id, adId: ad.id })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                    ad.active ? "bg-flag-green text-cream" : "bg-soft text-fg/55",
                  )}
                >
                  {ad.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {ad.active ? "Live" : "Paused"}
                </button>
                <button
                  onClick={() => user && removeAd.mutate({ adminId: user.id, adId: ad.id })}
                  className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
          {(!ads || ads.length === 0) && (
            <Card className="p-10 text-center text-sm text-fg/45">No ads yet — create one to showcase partners.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Mailbox (demo email outbox) ---------------- */

function Mailbox() {
  const { user, toast } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: emails } = useQuery(
    queryClient.emails.list.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );

  const markRead = useMutation(
    queryClient.emails.markRead.mutationOptions({
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const remove = useMutation(
    queryClient.emails.remove.mutationOptions({
      onSuccess: () => toast("Email deleted"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const clear = useMutation(
    queryClient.emails.clear.mutationOptions({
      onSuccess: () => toast("Mailbox cleared"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Demo mailbox ({emails?.length ?? 0})</p>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-fg/50">
            Every verification &amp; reset email the app sends lands here, so you can test
            flows without a mail server. <strong>In production, connect SMTP/Resend and this
            becomes an audit log.</strong>
          </p>
        </div>
        <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => user && clear.mutate({ adminId: user.id })}>
          <Trash2 size={13} /> Clear all
        </Button>
      </div>

      {emails?.map((e) => {
        const open = openId === e.id;
        return (
          <Card key={e.id} className="overflow-hidden">
            <button
              onClick={() => {
                setOpenId(open ? null : e.id);
                if (!e.read && user) markRead.mutate({ adminId: user.id, emailId: e.id });
              }}
              className="flex w-full items-center gap-3 p-4 text-left cursor-pointer hover:bg-soft/40 transition-colors"
            >
              <span className={cn("rounded-xl p-2.5", e.read ? "bg-soft text-fg/40" : "bg-flag-red text-cream")}>
                {e.read ? <MailOpen size={16} /> : <Mail size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", e.read ? "font-semibold text-fg/60" : "font-bold")}>
                  {e.subject}
                </p>
                <p className="text-[12px] text-fg/45">
                  To: {e.to} · {timeAgo(e.sentAt)}
                </p>
              </div>
              {e.debugCode && (
                <span className="rounded-full bg-flag-gold/20 px-2.5 py-1 font-display text-sm font-bold tracking-widest text-clay">
                  {e.debugCode}
                </span>
              )}
              {!e.read && <span className="h-2 w-2 rounded-full bg-flag-red" />}
            </button>
            {open && (
              <div className="border-t border-fg/8 bg-soft/40 px-5 py-4 animate-fade-in">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg/75">{e.body}</p>
                <button
                  onClick={() => user && remove.mutate({ adminId: user.id, emailId: e.id })}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-fg/50 hover:text-flag-red hover:bg-flag-red/5 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </Card>
        );
      })}

      {(!emails || emails.length === 0) && (
        <Card className="p-10 text-center text-sm text-fg/45">
          Mailbox is empty — sign up a new member to see verification emails here.
        </Card>
      )}
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fg/50">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fg/50">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
      />
    </div>
  );
}

const IMAGE_CHOICES = [
  "/output/images/hero.jpg",
  "/output/images/projects.jpg",
  "/output/images/education.jpg",
  "/output/images/economy.jpg",
  "/output/images/civic.jpg",
  "/output/images/community.jpg",
];

function ImagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = IMAGE_CHOICES.includes(value);
  return (
    <div className="mt-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
        <ImageIcon size={12} /> Image
      </label>
      <div className="flex flex-wrap gap-2">
        {IMAGE_CHOICES.map((img) => (
          <button
            key={img}
            onClick={() => onChange(img)}
            className={cn(
              "h-14 w-20 overflow-hidden rounded-xl border-2 transition-all cursor-pointer",
              value === img ? "border-flag-green ring-2 ring-flag-green/30" : "border-transparent opacity-60 hover:opacity-100",
            )}
          >
            <img src={img} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {!isPreset && (
          <div className="flex h-14 items-center rounded-xl border border-dashed border-fg/20 px-3 text-[11px] text-fg/40">
            <Eye size={12} className="mr-1" /> {value.split("/").pop()?.slice(0, 18)}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <input
          value={isPreset ? "" : value}
          onChange={(e) => e.target.value && onChange(e.target.value.trim())}
          placeholder="…or paste a custom image URL (Cloudinary, etc.)"
          className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
        />
        <p className="text-[10px] text-fg/40">
          Host images on Cloudinary (free tier) and paste the URL here — they load via CDN and work on any device.
        </p>
      </div>
    </div>
  );
}
