import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Video,
  Users,
  Loader2,
  Sparkles,
  Megaphone,
  CheckCircle2,
  ArrowRight,
  Globe2,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, Modal, SectionHeading } from "./ui";
import { cn } from "@/client/lib/format";
import { regionName, GHANA_REGIONS } from "@/server/data/regions";

const CATEGORY_COLORS: Record<string, string> = {
  Civic: "bg-flag-red text-cream",
  Social: "bg-flag-green text-cream",
  Fundraiser: "bg-flag-gold text-fg",
  Workshop: "bg-ink text-cream",
  Meetup: "bg-flag-green/10 text-flag-green border border-flag-green/20",
  Volunteer: "bg-flag-red/10 text-flag-red border border-flag-red/20",
};

export function Events() {
  const { user, toast, requireUser } = useStore();
  const [showCreate, setShowCreate] = useState(false);

  const { data: events } = useQuery(queryClient.events.list.queryOptions());
  const { data: ads } = useQuery(queryClient.events.adsPublic.queryOptions());

  const nowIso = new Date().toISOString();
  const upcoming = useMemo(
    () => (events ?? []).filter((e) => e.date >= nowIso).sort((a, b) => a.date.localeCompare(b.date)),
    [events, nowIso],
  );
  const past = useMemo(
    () => (events ?? []).filter((e) => e.date < nowIso).sort((a, b) => b.date.localeCompare(a.date)),
    [events, nowIso],
  );

  const rsvp = useMutation(
    queryClient.events.rsvp.mutationOptions({
      onSuccess: () => toast("Attendance updated! +15 points 🎉"),
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );

  const me = requireUser();

  const showAds = (ads ?? []).filter((a) => a.placement === "both" || a.placement === "events");

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden bg-ink text-cream pt-36 pb-16">
        <div className="absolute inset-0">
          <img src="/output/images/community.jpg" alt="Events" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">
            <CalendarDays size={14} /> Events & activities
          </p>
          <h1 className="max-w-2xl font-display text-4xl sm:text-6xl font-bold leading-tight">
            Show up. <span className="gold-gradient-text">Show Ghana.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-cream/70">
            Registration drives, volunteer days, workshops and meetups — organised by members
            and partners, open to every Ghanaian. Attending earns you rank points.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              variant="gold"
              onClick={() => {
                if (!me) return toast("Join the circle first to organise events", "error");
                if (!["admin", "moderator", "vip"].includes(me.role))
                  return toast("Organising events requires VIP, moderator or admin status — keep contributing!", "error");
                setShowCreate(true);
              }}
            >
              <Sparkles size={16} /> Organise an event
            </Button>
            <Button variant="ghost" className="border border-cream/25 text-cream hover:bg-page/10" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
              Past activities <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Showcase ads */}
        {showAds.length > 0 && (
          <section className="-mt-8 relative z-10">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-fg/45">
              <Megaphone size={13} /> Showcase — supported by our partners
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {showAds.map((ad) => (
                <a
                  key={ad.id}
                  href={ad.link}
                  onClick={(e) => {
                    if (ad.link === "#") e.preventDefault();
                    rpcClient.events.adClick({ adId: ad.id }).catch(() => {});
                  }}
                  className="group relative h-44 overflow-hidden rounded-3xl shadow-lg card-lift"
                >
                  <img src={ad.image} alt={ad.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <Chip tone="gold" className="mb-2">{ad.sponsor}</Chip>
                    <p className="font-display text-xl font-bold leading-tight text-cream">{ad.title}</p>
                    <p className="mt-1 line-clamp-1 text-[13px] text-cream/70">{ad.tagline}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        <section className="py-14">
          <SectionHeading
            eyebrow="Coming up"
            title={<>Upcoming <span className="text-flag-red">events</span></>}
            className="mb-8"
          />
          {upcoming.length === 0 && (
            <Card className="p-12 text-center text-sm text-fg/45">No upcoming events yet — organise one!</Card>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => {
              const attending = me ? e.attendees.includes(me.id) : false;
              const d = new Date(e.date);
              return (
                <Card key={e.id} hover className="flex flex-col overflow-hidden">
                  <div className="relative h-40 overflow-hidden">
                    <img src={e.image} alt={e.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <Chip tone="gold">
                        {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </Chip>
                      {e.featured && <Chip tone="red"><Sparkles size={11} /> Featured</Chip>}
                    </div>
                    <span className={cn("absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", CATEGORY_COLORS[e.category])}>
                      {e.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-display text-lg font-bold leading-snug">{e.title}</p>
                    <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-fg/60">{e.description}</p>
                    <div className="mt-3 space-y-1.5 text-[12px] font-semibold text-fg/55">
                      <p className="flex items-center gap-2">
                        <CalendarDays size={13} className="text-flag-red" />
                        {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })} · {e.time}
                      </p>
                      <p className="flex items-center gap-2">
                        {e.mode === "virtual" ? <Video size={13} className="text-flag-green" /> : <MapPin size={13} className="text-flag-green" />}
                        {e.location} · {regionName(e.region)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Users size={13} className="text-flag-red" /> {e.attendeeCount} attending · organised by {e.organizer}
                      </p>
                    </div>
                    <Button
                      variant={attending ? "dark" : "gold"}
                      className="mt-4 w-full"
                      disabled={rsvp.isPending}
                      onClick={() => {
                        if (!me) return toast("Join the circle to RSVP", "error");
                        rsvp.mutate({ memberId: me.id, eventId: e.id });
                      }}
                    >
                      {rsvp.isPending ? <Loader2 size={15} className="animate-spin" /> : attending ? <CheckCircle2 size={15} /> : <Users size={15} />}
                      {attending ? "You're attending" : "RSVP — earn 15 pts"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Past activities */}
        {past.length > 0 && (
          <section className="pb-20">
            <SectionHeading
              eyebrow="What we've done"
              title={<>Past <span className="text-flag-green">activities</span></>}
              className="mb-8"
            />
            <div className="space-y-4">
              {past.map((e) => {
                const d = new Date(e.date);
                return (
                  <Card key={e.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-ink text-cream">
                      <span className="font-display text-xl font-bold">{d.getDate()}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-flag-gold">
                        {d.toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-bold leading-snug">{e.title}</p>
                      <p className="mt-1 line-clamp-1 text-[13px] text-fg/55">
                        {e.location} · {e.category} · {e.attendeeCount} attended · {e.organizer}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip tone="sand">{e.category}</Chip>
                      {e.mode === "virtual" && <Chip tone="green"><Globe2 size={11} /> Online</Chip>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const { user, toast } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [region, setRegion] = useState("greater-accra");
  const [mode, setMode] = useState<"physical" | "virtual">("physical");
  const [category, setCategory] = useState("Civic");
  const [image, setImage] = useState("/output/images/community.jpg");
  const [busy, setBusy] = useState(false);

  const submit = useMutation(
    queryClient.events.create.mutationOptions({
      onSuccess: () => {
        toast("Event published! 🎉");
        onClose();
      },
      onError: (e: any) => toast(e?.message ?? "Failed to create", "error"),
    }),
  );

  const IMAGES = [
    "/output/images/hero.jpg",
    "/output/images/projects.jpg",
    "/output/images/education.jpg",
    "/output/images/economy.jpg",
    "/output/images/civic.jpg",
    "/output/images/community.jpg",
  ];

  return (
    <Modal open onClose={onClose} wide>
      <div className="p-6 sm:p-8">
        <p className="mb-1 font-display text-2xl font-bold">Organise an event</p>
        <p className="mb-5 text-sm text-fg/55">
          Open to VIP, moderator and admin members. Activities reach every member and earn attendees rank points.
        </p>
        <div className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title"
            className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will happen? Who should come?"
            className="h-28 w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red" />
            </label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (town / online link)"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red" />
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none cursor-pointer">
              {GHANA_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none cursor-pointer">
              <option value="physical">Physical</option>
              <option value="virtual">Virtual / online</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none cursor-pointer">
              {["Civic", "Social", "Fundraiser", "Workshop", "Meetup", "Volunteer"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-fg/55">Cover image</span>
            <div className="flex flex-wrap gap-2">
              {IMAGES.map((img) => (
                <button key={img} onClick={() => setImage(img)}
                  className={cn("h-14 w-20 overflow-hidden rounded-xl border-2 transition-all cursor-pointer", image === img ? "border-flag-green ring-2 ring-flag-green/30" : "border-transparent opacity-60 hover:opacity-100")}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <input
              value={IMAGES.includes(image) ? "" : image}
              onChange={(e) => e.target.value && setImage(e.target.value.trim())}
              placeholder="…or paste a custom image URL (Cloudinary, etc.)"
              className="mt-2 w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
            />
          </div>
          <Button
            variant="dark"
            className="w-full py-3"
            disabled={busy || !title.trim() || !date || !location.trim()}
            onClick={() => {
              if (!user) return;
              setBusy(true);
              submit.mutate({
                memberId: user.id,
                event: {
                  title,
                  description: description || "Join us — everyone is welcome.",
                  date: new Date(date).toISOString(),
                  time,
                  location,
                  region,
                  mode,
                  category: category as any,
                  organizer: user.name,
                  image,
                  featured: false,
                },
              });
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Publish event"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
