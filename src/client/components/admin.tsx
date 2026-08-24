import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, Toggle, Avatar } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { DeepSeekRateCard, DeepSeekStatusPill } from "./deepseek-card";
import { captchaConfigured } from "@/client/lib/captcha";
import { cn, timeAgo } from "@/client/lib/format";
import { GHANA_REGIONS } from "@/server/data/regions";
import type { Settings } from "@/server/rpc/site";

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
  const remove = useMutation(
    queryClient.members.remove.mutationOptions({
      onSuccess: () => toast("Member removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

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
              </div>
              <p className="truncate text-[12px] text-fg/45">
                {m.email} · {GHANA_REGIONS.find((r) => r.id === m.region)?.name ?? m.region}
                {m.diasporaCountry ? ` · diaspora: ${m.diasporaCountry}` : ""}
              </p>
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
                onClick={() => user && remove.mutate({ adminId: user.id, memberId: m.id })}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                title="Remove member"
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
    </Card>
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
  const { data: posts } = useQuery(queryClient.posts.list.queryOptions());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("News");
  const [author, setAuthor] = useState(user?.name ?? "");
  const [image, setImage] = useState("/output/images/hero.jpg");
  const [featured, setFeatured] = useState(false);

  const create = useMutation(
    queryClient.posts.create.mutationOptions({
      onSuccess: () => {
        toast("Post published 📣");
        setOpen(false);
        setTitle("");
        setBody("");
      },
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const toggle = useMutation(
    queryClient.posts.toggleFeatured.mutationOptions({
      onSuccess: () => toast("Featured updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const remove = useMutation(
    queryClient.posts.remove.mutationOptions({
      onSuccess: () => toast("Post removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg/55">Publish news, stories, civic & economy content to the site.</p>
        <Button variant="dark" onClick={() => setOpen(true)}><Plus size={15} /> New post</Button>
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
            >
              <Trash2 size={15} />
            </button>
          </div>
        </Card>
      ))}

      {open && (
        <Card className="p-6">
          <p className="mb-4 text-sm font-bold">New post</p>
          <div className="space-y-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm font-semibold outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Post body…"
              className="h-36 w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15" />
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
            <Button
              variant="dark"
              className="w-full py-3"
              disabled={create.isPending || title.trim().length < 3 || body.trim().length < 10}
              onClick={() => {
                if (!user) return;
                create.mutate({
                  adminId: user.id,
                  post: { title, body, category: category as any, author, image, featured },
                });
              }}
            >
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : "Publish post"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Moderation ---------------- */

function ModerationPanel() {
  const { user, toast } = useStore();
  const { data: reports } = useQuery(
    queryClient.community.getReports.queryOptions({
      input: { adminId: user?.id ?? "" },
      enabled: !!user,
    }),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
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
      onSuccess: () => toast("Room updated"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const removeRoom = useMutation(
    queryClient.community.removeRoom.mutationOptions({
      onSuccess: () => toast("Room removed"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );
  const createRoom = useMutation(
    queryClient.community.createRoom.mutationOptions({
      onSuccess: () => toast("Room created 🎉"),
      onError: (e: any) => toast(e?.message, "error"),
    }),
  );

  const [newRoom, setNewRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomIcon, setRoomIcon] = useState("💬");

  return (
    <div className="space-y-6">
      {/* Reports */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-fg/8 p-4">
          <p className="text-sm font-bold">Reports ({reports?.filter((r) => r.status === "open").length ?? 0} open)</p>
          <Chip tone={overview && overview.counts.openReports > 0 ? "red" : "green"}>
            {overview && overview.counts.openReports > 0 ? `${overview.counts.openReports} need review` : "All clear"}
          </Chip>
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{r.name} {r.pinned && <Pin size={11} className="inline text-flag-red" />}</p>
                <p className="truncate text-[12px] text-fg/45">{r.description} · {r.messageCount} messages</p>
              </div>
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
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
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
