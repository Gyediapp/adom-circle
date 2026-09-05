import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  HeartHandshake,
  Clock,
  MapPin,
  Loader2,
  ChevronDown,
  Plus,
  Users,
  Briefcase,
  Package,
  Wallet,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, Modal, ProgressBar, Stat } from "./ui";
import { MdEditor } from "./md-editor";
import { RichText, plainText } from "@/client/lib/markdown";
import { formatNumber, cn } from "@/client/lib/format";
import { GHANA_REGIONS } from "@/server/data/regions";

const THEMES = ["All", "Education", "Health", "Youth", "Environment", "Civic", "Economic"] as const;
const STATUS_COLORS: Record<string, string> = {
  planned: "bg-flag-gold text-fg",
  ongoing: "bg-flag-green text-cream",
  completed: "bg-ink text-cream",
};

const CONTRIB_TYPES = [
  { id: "Time", icon: Clock, desc: "Volunteer hours" },
  { id: "Skills", icon: Briefcase, desc: "Mentoring & services" },
  { id: "Resources", icon: Package, desc: "Tools & materials" },
  { id: "Financial", icon: Wallet, desc: "Optional, private" },
] as const;

export function Projects() {
  const { user, toast, requireUser } = useStore();
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: projects } = useQuery(queryClient.projects.liveProjects.list.experimental_liveOptions());
  const { data: settings } = useQuery(queryClient.site.get.queryOptions());

  const filtered = useMemo(
    () => (projects ?? []).filter((p) => theme === "All" || p.theme === theme),
    [projects, theme],
  );

  const selected = projects?.find((p) => p.id === selectedId);

  const me = requireUser();

  return (
    <div className="mx-auto max-w-7xl px-4 pt-36 pb-20 sm:px-6">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
            <HeartHandshake size={14} /> Projects & impact
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">
            Giving back, <span className="text-flag-green">measured.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg/60">
            Every project is proposed by members, approved by leadership, and tracked transparently —
            volunteers, hours, regions and milestones.
          </p>
        </div>
        <Button
          variant="dark"
          onClick={() => {
            if (!me) return toast("Sign in to submit a project", "error");
            setShowSubmit(true);
          }}
        >
          <Plus size={16} /> Submit a project
        </Button>
      </div>

      {/* Impact strip */}
      <div className="mb-10 grid grid-cols-2 gap-4 rounded-3xl bg-ink p-6 text-cream sm:grid-cols-4 sm:p-8">
        <Stat label="Projects" value={formatNumber(settings?.stats.projects ?? 86)} accent />
        <Stat label="Volunteers" value={formatNumber(settings?.stats.volunteers ?? 3800)} accent />
        <Stat label="Hours given" value={`${formatNumber(settings?.stats.hours ?? 52300)}+`} accent />
        <Stat label="Regions" value="16 / 16" accent />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-fg/40" />
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer",
              theme === t ? "bg-ink text-cream" : "bg-soft text-fg/60 hover:text-fg",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Project grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id} hover className="flex flex-col overflow-hidden cursor-pointer" >
            <button onClick={() => setSelectedId(p.id)} className="text-left cursor-pointer">
              <div className="relative h-44 overflow-hidden">
                <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <Chip tone="gold" className="absolute left-3 top-3">{p.theme}</Chip>
                <span className={cn("absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", STATUS_COLORS[p.status])}>
                  {p.status}
                </span>
              </div>
            </button>
            <div className="flex flex-1 flex-col p-5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                <MapPin size={11} /> {p.location} · {p.region}
              </p>
              <button onClick={() => setSelectedId(p.id)} className="mt-1 cursor-pointer">
                <p className="font-display text-lg font-bold leading-snug hover:text-flag-red transition-colors">{p.title}</p>
              </button>
              <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-fg/60">{plainText(p.description)}</p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-fg/50">
                  <span className="flex items-center gap-1"><Users size={12} /> {p.volunteers}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatNumber(p.hours)} hrs</span>
                </div>
                <ProgressBar value={(p.hours / 2500) * 100} />
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setSelectedId(p.id)}>
                View & contribute <ChevronDown size={15} className="rotate-[-90deg]" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Project detail modal */}
      {selected && (
        <ProjectModal
          projectId={selected.id}
          onClose={() => setSelectedId(null)}
          onContribute={(type, note, hours) => {
            if (!me) return toast("Sign in to contribute", "error");
            return rpcClient.projects.addContribution({
              memberId: me.id,
              projectId: selected.id,
              type: type as any,
              note,
              hours,
            });
          }}
        />
      )}

      {/* Submit project modal */}
      {showSubmit && <SubmitProjectModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

function ProjectModal({
  projectId,
  onClose,
  onContribute,
}: {
  projectId: string;
  onClose: () => void;
  onContribute: (type: string, note: string, hours: number) => void | Promise<unknown>;
}) {
  const { data } = useQuery(
    queryClient.projects.getProject.queryOptions({ input: projectId }),
  );
  const [type, setType] = useState<string>("Time");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const { toast } = useStore();

  if (!data) return null;
  const { project, contributions } = data;

  return (
    <Modal open onClose={onClose} wide>
      <div className="relative">
        <div className="relative h-52 overflow-hidden rounded-t-3xl">
          <img src={project.image} alt={project.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="gold">{project.theme}</Chip>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", STATUS_COLORS[project.status])}>
                {project.status}
              </span>
              <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold text-cream backdrop-blur">
                {project.location} · {project.region}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{project.title}</h2>
          <p className="mt-2 text-sm font-semibold text-fg/50">Sponsored by {project.sponsor}</p>
          <RichText text={project.description} className="mt-3 text-sm text-fg/70" />

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-soft/60 p-4">
            <div>
              <p className="font-display text-2xl font-bold text-flag-red">{formatNumber(project.volunteers)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/50">Volunteers</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-flag-green">{formatNumber(project.hours)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/50">Hours</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{contributions.length}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/50">Contributions</p>
            </div>
          </div>

          {project.milestones.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-fg/50">Milestones</p>
              <div className="space-y-2">
                {project.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-fg/70">
                    <CheckCircle2 size={15} className="text-flag-green shrink-0" /> {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contribute */}
          <div className="mt-6 rounded-2xl border border-flag-green/25 bg-flag-green/5 p-5">
            <p className="mb-3 text-sm font-bold">Contribute to this project</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {CONTRIB_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-left transition-all cursor-pointer",
                    type === t.id
                      ? "border-flag-green bg-flag-green text-cream"
                      : "border-fg/12 bg-card hover:border-flag-green/50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold">
                    <t.icon size={14} /> {t.id}
                  </span>
                  <span className={cn("block text-[10px]", type === t.id ? "text-cream/70" : "text-fg/40")}>
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
            {type === "Time" && (
              <div className="mb-3">
                <span className="mb-1 block text-xs font-semibold text-fg/55">Hours volunteered</span>
                <input
                  type="number"
                  min={0}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-28 rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
                />
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`What will you contribute? e.g. "Teaching a Saturday coding class"`}
              className="h-20 w-full rounded-xl border border-fg/15 bg-card px-4 py-2.5 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15"
            />
            <Button
              variant="dark"
              className="mt-3 w-full py-3"
              disabled={note.trim().length < 3 || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onContribute(type, note.trim(), hours);
                  toast(`Contribution recorded — ${project.title} 💚`);
                  setNote("");
                } catch (e: any) {
                  toast(e?.message ?? "Failed to record", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Record my contribution"}
            </Button>
          </div>

          {/* Recent contributions */}
          {contributions.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-fg/50">Recent contributions</p>
              <div className="space-y-2.5">
                {contributions.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-soft/50 px-4 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-flag-gold">
                      {c.type.slice(0, 1)}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold">{c.memberName}</p>
                      <p className="text-[12px] text-fg/50">{c.note}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-fg/40">
                      {c.type}{c.hours > 0 ? ` · ${c.hours}h` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function SubmitProjectModal({ onClose }: { onClose: () => void }) {
  const { user, toast } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [region, setRegion] = useState("greater-accra");
  const [theme, setTheme] = useState("Education");
  const [sponsor, setSponsor] = useState("");
  const [image, setImage] = useState("/output/images/projects.jpg");
  const [busy, setBusy] = useState(false);

  const submit = useMutation(
    queryClient.projects.submit.mutationOptions({
      onSuccess: () => {
        toast("Project submitted! Our team will review it.");
        onClose();
      },
      onError: (e: any) => toast(e?.message ?? "Failed to submit", "error"),
    }),
  );

  return (
    <Modal open onClose={onClose} wide>
      <div className="p-6 sm:p-8">
        <p className="mb-1 font-display text-2xl font-bold">Submit a project</p>
        <p className="mb-5 text-sm text-fg/55">
          Propose a development project for Ghana. Admins review every proposal.
        </p>
        <div className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title"
            className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15" />
          <MdEditor value={description} onChange={setDescription} placeholder="Describe the project — need, plan, community impact…" rows={5} />
          <div className="grid gap-4 sm:grid-cols-2">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Town / city"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15" />
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green cursor-pointer">
              {GHANA_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.capital}</option>
              ))}
            </select>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green cursor-pointer">
              {THEMES.filter((t) => t !== "All").map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Sponsor / partner (optional)"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15" />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-fg/55">Cover image</span>
            <div className="flex flex-wrap gap-2">
              {["/output/images/hero.jpg", "/output/images/projects.jpg", "/output/images/education.jpg", "/output/images/economy.jpg", "/output/images/civic.jpg", "/output/images/community.jpg"].map((img) => (
                <button key={img} onClick={() => setImage(img)}
                  className={cn("h-14 w-20 overflow-hidden rounded-xl border-2 transition-all cursor-pointer", image === img ? "border-flag-green ring-2 ring-flag-green/30" : "border-transparent opacity-70 hover:opacity-100")}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <input
              value={["/output/images/hero.jpg", "/output/images/projects.jpg", "/output/images/education.jpg", "/output/images/economy.jpg", "/output/images/civic.jpg", "/output/images/community.jpg"].includes(image) ? "" : image}
              onChange={(e) => e.target.value && setImage(e.target.value.trim())}
              placeholder="…or paste a custom image URL (Cloudinary, etc.)"
              className="mt-2 w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
            />
          </div>
          <Button variant="dark" className="w-full py-3" disabled={busy || title.trim().length < 3 || description.trim().length < 10}
            onClick={() => {
              if (!user) return;
              setBusy(true);
              submit.mutate({
                memberId: user.id,
                title,
                description,
                location: location || "Nationwide",
                region,
                theme: theme as any,
                sponsor: sponsor || "Member proposal",
                image,
              });
            }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Submit for review"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
