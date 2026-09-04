import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  HeartHandshake,
  Landmark,
  Scale,
  TrendingUp,
  Vote,
  MapPin,
  MessageSquareHeart,
  Sparkles,
  ChevronRight,
  CalendarDays,
  Users,
  Clock,
  HandHeart,
  Megaphone,
  Video,
  Handshake,
  Flame,
  Link2,
  ThumbsUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { useI18n } from "@/client/lib/i18n";
import { SocialLinks } from "./socials";
import { Avatar, Button, Card, Chip, Modal, SectionHeading, Stat, ProgressBar } from "./ui";
import { MemberModal } from "./member-modal";
import { FacebookIcon, WhatsAppIcon, YouTubeIcon, TikTokIcon } from "@/client/lib/brand-icons";
import { LogoMark, Star } from "@/client/lib/logo";
import { GHANA_REGIONS, regionName, type GhanaRegion } from "@/server/data/regions";
import { formatNumber, timeAgo, cn } from "@/client/lib/format";
import type { Tab } from "./navbar";
import type { PublicMember } from "@/server/rpc/members";

const THEME_ICONS: Record<string, React.ReactNode> = {
  Education: <Sparkles size={18} />,
  Health: <HeartHandshake size={18} />,
  Youth: <Users size={18} />,
  Environment: <HandHeart size={18} />,
  Civic: <Vote size={18} />,
  Economic: <TrendingUp size={18} />,
};

// The major activity links — shown at the very top of the landing page so
// new visitors see everything the circle offers without scrolling.
const QUICK_ACTIONS: Array<{ tab: Tab; label: string; icon: React.ElementType; hint: string }> = [
  { tab: "community", label: "Community", icon: MessageSquareHeart, hint: "Chat & forum" },
  { tab: "projects", label: "Projects", icon: HandHeart, hint: "Volunteer & impact" },
  { tab: "events", label: "Events", icon: CalendarDays, hint: "Meet & RSVP" },
  { tab: "civic", label: "Civic", icon: Vote, hint: "Constitution & voting" },
  { tab: "economy", label: "Economy", icon: TrendingUp, hint: "Invest & buy Ghanaian" },
];

// Table of contents — jump-to links for the long landing page
const TOC_ITEMS = [
  { id: "circle", label: "The Circle" },
  { id: "impact", label: "Impact" },
  { id: "projects", label: "Projects" },
  { id: "events", label: "Events" },
  { id: "civic", label: "Civic" },
  { id: "community", label: "Community" },
  { id: "stories", label: "Stories" },
  { id: "connect", label: "Connect" },
];

// Brand cards for the "Stay connected everywhere" section — driven by admin socials
const SOCIAL_BRANDS: Array<{
  platform: string;
  title: string;
  tagline: string;
  icon: React.ElementType;
  bg: string;
}> = [
  { platform: "whatsapp", title: "WhatsApp Channel", tagline: "Daily announcements", icon: WhatsAppIcon, bg: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" },
  { platform: "youtube", title: "YouTube", tagline: "Watch our stories", icon: YouTubeIcon, bg: "linear-gradient(135deg, #FF0000 0%, #b30000 100%)" },
  { platform: "facebook", title: "Facebook", tagline: "Page & discussion group", icon: FacebookIcon, bg: "linear-gradient(135deg, #1877F2 0%, #0e5fd8 100%)" },
  { platform: "tiktok", title: "TikTok", tagline: "Short clips & vibes", icon: TikTokIcon, bg: "linear-gradient(135deg, #000000 0%, #1d4a38 100%)" },
];

export function Home({
  onTab,
  onAuth,
}: {
  onTab: (t: Tab) => void;
  onAuth: (m: "login" | "signup") => void;
}) {
  const { user, toast } = useStore();
  const { t } = useI18n();

  const { data: settings } = useQuery(queryClient.site.get.queryOptions());
  const { data: projects } = useQuery(queryClient.projects.getProjects.queryOptions());
  const { data: posts } = useQuery(queryClient.posts.list.queryOptions());
  const { data: wallSuggestions = [] } = useQuery(
    queryClient.suggestions.list.queryOptions(),
  );
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { data: liveRooms = {} } = useQuery(
    queryClient.community.roomPresence.queryOptions({
      refetchInterval: 15_000,
    }),
  );
  const { data: ads } = useQuery(queryClient.events.adsPublic.queryOptions());
  const { data: events } = useQuery(queryClient.events.list.queryOptions());
  const { data: threads } = useQuery(
    queryClient.community.liveThreads.list.experimental_liveOptions(),
  );
  // "Meet the circle" — public member strip (avatars + online status)
  const { data: directory } = useQuery(
    queryClient.members.directory.queryOptions({
      refetchInterval: 30_000,
    }),
  );

  const stats = settings?.stats;

  // Featured events carousel
  const [paused, setPaused] = useState(false);
  const [region, setRegion] = useState<GhanaRegion | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const featuredEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.featured && e.date >= new Date().toISOString())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [events],
  );

  // Auto-scroll the featured carousel; pause while hovered / touched
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || featuredEvents.length <= 1) return;
    const id = setInterval(() => {
      if (paused) return;
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: Math.min(340, max - el.scrollLeft), behavior: "smooth" });
    }, 3500);
    return () => clearInterval(id);
  }, [paused, featuredEvents.length]);

  // Hot conversations — most engaged threads from the last 14 days
  const hotThreads = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return (threads ?? [])
      .filter((t) => new Date(t.createdAt).getTime() >= cutoff)
      .sort((a, b) => (b.likes + b.replyCount) - (a.likes + a.replyCount))
      .slice(0, 3);
  }, [threads]);

  const shareThread = (title: string, authorName: string) => {
    const text = `🔥 ${title} — ${authorName} on Adom Circle 🇬🇭 Join the discussion: https://adomcircle.org/community`;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://adomcircle.org/community")}&quote=${encodeURIComponent(text)}`,
      text,
    };
  };

  const heroProjects = useMemo(
    () => (projects ?? []).filter((p) => p.status !== "planned").slice(0, 4),
    [projects],
  );

  const homeAds = useMemo(
    () => (ads ?? []).filter((a) => a.placement === "home" || a.placement === "both"),
    [ads],
  );

  const upcomingEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.date >= new Date().toISOString())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [events],
  );

  const go = (t: Tab) => {
    onTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to the Civic page and scroll straight to the Voice for Ghana wall.
  const goVoiceWall = () => {
    onTab("civic");
    window.setTimeout(() => {
      document.getElementById("voice")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  // Jump straight into a specific chatroom from the homepage.
  const joinRoom = (roomId: string) => {
    try {
      sessionStorage.setItem("adom_pending_room", roomId);
    } catch {
      // ignore
    }
    go("community");
  };

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="hero-full relative overflow-hidden bg-ink text-cream">
        <div className="absolute inset-0">
          <img
            src="/output/images/hero.jpg"
            alt="Ghana — land of peace and pride"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/55 to-ink" />
          <div className="absolute inset-0 hero-grid opacity-60" />
        </div>

        {/* Oversized brand watermark — subtle premium depth */}
        <div
          className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 rotate-6 opacity-[0.07] xl:block"
          aria-hidden
        >
          <LogoMark size={420} />
        </div>

        <div className="hero-full relative mx-auto flex max-w-7xl flex-col justify-center px-4 pb-24 pt-32 sm:px-6">
          <div className="max-w-3xl">
            <p className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-cream/20 bg-page/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-soft backdrop-blur">
              <Star size={13} className="text-flag-gold" />
              {settings?.hero.badge}
            </p>

            {/* MAJOR ACTIVITY LINKS — top of page for new visitors */}
            <div className="animate-fade-up mb-8 flex flex-wrap items-center gap-2" style={{ animationDelay: "0.05s" }}>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q.tab}
                  onClick={() => go(q.tab)}
                  className="group flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-flag-gold hover:border-flag-gold hover:shadow-glow-gold cursor-pointer"
                  title={q.hint}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flag-red/90 text-cream shadow-md transition-colors group-hover:bg-ink group-hover:text-flag-gold">
                    <q.icon size={15} />
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-bold leading-none text-cream group-hover:text-ink">{q.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-cream/50 group-hover:text-ink/60">{q.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* MEET THE CIRCLE — live member strip (social proof above the fold) */}
            {directory && directory.length > 0 && (
              <div className="animate-fade-up mb-8" style={{ animationDelay: "0.08s" }}>
                <MembersMarquee members={directory} user={user} onAuth={onAuth} />
              </div>
            )}

            {/* Social links — follow the circle */}
            <div className="animate-fade-up mb-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.1s" }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cream/45">
                Follow the circle
              </span>
              <SocialLinks socials={settings?.socials ?? []} tone="light" />
            </div>

            <h1 className="animate-fade-up font-display text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl" style={{ animationDelay: "0.1s" }}>
              {settings?.hero.title}
              <br />
              <span className="gold-gradient-text italic">{settings?.hero.highlight}</span>
            </h1>

            <p className="animate-fade-up mt-6 max-w-xl text-base leading-relaxed text-cream/80 sm:text-lg" style={{ animationDelay: "0.2s" }}>
              {settings?.hero.subtitle}
            </p>

            <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.3s" }}>
              <Button variant="gold" className="px-7 py-3.5 text-base" onClick={() => (user ? go("community") : onAuth("signup"))}>
                {user ? t("community") : t("join")}
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="ghost"
                className="border border-cream/25 px-7 py-3.5 text-base text-cream hover:bg-cream/10"
                onClick={() => go("projects")}
              >
                {t("impact")}
              </Button>
            </div>

            {/* Stats bar */}
            <div className="animate-fade-up mt-14 max-w-2xl" style={{ animationDelay: "0.45s" }}>
              <div className="mb-7 flex items-center gap-3">
                <span className="flag-stripes h-[3px] w-28 rounded-full" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cream/45">
                  The circle in numbers
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[
                  { value: formatNumber(stats?.members ?? 12480), label: "Members" },
                  { value: formatNumber(stats?.projects ?? 86), label: "Projects" },
                  { value: "16", label: "Regions united" },
                  { value: `${formatNumber(stats?.hours ?? 52300)}+`, label: "Volunteer hours" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="font-display text-3xl font-bold text-flag-gold">{s.value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/60">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-float text-cream/40">
          <ChevronRight className="rotate-90" size={20} />
        </div>
      </section>

      {/* ================= FLAG MARQUEE ================= */}
      <div className="relative z-10 overflow-hidden bg-ink py-4">
        <div className="flag-stripes h-[3px] w-full" aria-hidden />
        <div className="flex w-max animate-marquee gap-12 py-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-12 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.32em]">
              <span className="text-cream/75">One Circle</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-flag-gold">One Ghana</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-cream/75">Peace</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-flag-gold">Progress</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-cream/75">Constitution Above All</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-flag-gold">16 Regions</span>
              <Star size={14} className="text-ink" outline />
              <span className="text-cream/75">Black Star Forever</span>
              <Star size={14} className="text-ink" outline />
            </div>
          ))}
        </div>
        <div className="flag-stripes h-[3px] w-full" aria-hidden />
      </div>

      {/* ================= TABLE OF CONTENTS ================= */}
      <div className="sticky top-[96px] z-30 border-b border-fg/5 bg-page/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto no-scrollbar px-4 py-3 sm:px-6">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.25em] text-fg/40">
            Jump to
          </span>
          {TOC_ITEMS.map((s) => (
            <button
              key={s.id}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="shrink-0 rounded-full border border-fg/10 bg-card px-3.5 py-1.5 text-[12px] font-semibold text-fg/60 transition-colors hover:border-flag-red hover:text-flag-red cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= MISSION / VALUES ================= */}
      <section id="circle" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Why Adom Circle exists"
              title={<>A circle that holds <span className="text-flag-red">Ghana</span> together.</>}
              sub={settings?.mission}
            />
            <div className="mt-8 rounded-3xl border border-flag-gold/40 border-l-4 border-l-flag-gold bg-gold-soft/25 p-6 shadow-sm">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-clay">
                <Landmark size={16} /> The Constitution is supreme
              </p>
              <p className="text-sm leading-relaxed text-fg/75">
                The Constitution of Ghana stands above any denomination, institution or group.
                Every member accepts and abides by it — that is the foundation of our peace,
                and the door is open to every Ghanaian who does the same.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {settings?.values.map((v, i) => (
              <Card key={v.title} hover className="p-6" >
                <div className="mb-3 inline-flex rounded-2xl bg-ink p-2.5 text-flag-gold" style={{ animationDelay: `${i * 0.05}s` }}>
                  <ValueIcon icon={v.icon} />
                </div>
                <p className="font-display text-lg font-bold">{v.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg/60">{v.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= IMPACT + REGIONS ================= */}
      <section id="impact" className="scroll-mt-28 bg-ink text-cream py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <SectionHeading
              light
              eyebrow="Impact you can count"
              title={<>Real contributions, <span className="gold-gradient-text">measured honestly.</span></>}
              sub="Every hour volunteered, every project sponsored, every region reached — tracked and shared transparently."
            />
            <Button variant="gold" onClick={() => go("projects")}>
              Explore all projects <ArrowRight size={16} />
            </Button>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            {/* Region map panel */}
            <Card className="p-6 lg:col-span-2 bg-card/5 border-white/10 text-cream">
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-gold-soft">
                <MapPin size={14} /> All 16 regions, one circle
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GHANA_REGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRegion(r)}
                    className="group rounded-xl border border-white/10 bg-card/5 px-3 py-2 text-left transition-all hover:border-flag-gold/70 hover:bg-flag-gold/10 cursor-pointer"
                    title={`Explore ${r.name}`}
                  >
                    <p className="flex items-center gap-1 text-[13px] font-bold group-hover:text-flag-gold">
                      {r.name}
                      <ChevronRight size={11} className="opacity-0 -ml-1 transition-all group-hover:opacity-100" />
                    </p>
                    <p className="text-[11px] text-cream/50">{r.capital}</p>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-cream/60">
                From Nalerigu to Sekondi, Ho to Wa — tap any region to see what's happening there,
                plus diaspora chapters across 14 countries.
              </p>
            </Card>

            {/* Impact metrics */}
            <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2">
              <Card className="p-6 bg-card/5 border-white/10 text-cream">
                <Stat label="Volunteer hours logged" value={`${formatNumber(stats?.hours ?? 52300)}+`} accent />
                <p className="mt-4 text-[13px] text-cream/60">Time is the truest currency of love for country.</p>
              </Card>
              <Card className="p-6 bg-card/5 border-white/10 text-cream">
                <Stat label="Members joined" value={formatNumber(stats?.members ?? 12480)} accent />
                <p className="mt-4 text-[13px] text-cream/60">At home and in the diaspora — all welcome.</p>
              </Card>
              <Card className="p-6 bg-card/5 border-white/10 text-cream">
                <Stat label="Projects sponsored" value={formatNumber(stats?.projects ?? 86)} accent />
                <p className="mt-4 text-[13px] text-cream/60">Education, health, water, youth, environment, economy.</p>
              </Card>
              <Card className="p-6 bg-card/5 border-white/10 text-cream">
                <Stat label="Regions reached" value="16 / 16" accent />
                <p className="mt-4 text-[13px] text-cream/60">Every region of Ghana represented in the circle.</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURED PROJECTS ================= */}
      <section id="projects" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
        <SectionHeading
          eyebrow="Projects on the ground"
          title={<>Stories of <span className="text-flag-green">service</span> across Ghana.</>}
          sub="Sponsored by members and partners, delivered by volunteers — with transparent milestones."
          className="mb-12"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {heroProjects.map((p, i) => (
            <Card key={p.id} hover className="overflow-hidden flex flex-col">
              <div className="relative h-44 overflow-hidden">
                <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <Chip tone="gold" className="absolute left-3 top-3">
                  {THEME_ICONS[p.theme]} {p.theme}
                </Chip>
                <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cream backdrop-blur">
                  {p.status}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                  {p.location} · {p.region}
                </p>
                <p className="mt-1 font-display text-lg font-bold leading-snug">{p.title}</p>
                <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-fg/60">{p.description}</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-fg/50">
                    <span>{p.volunteers} volunteers</span>
                    <span>{formatNumber(p.hours)} hrs</span>
                  </div>
                  <ProgressBar value={(p.hours / 2500) * 100} />
                </div>
                <button
                  onClick={() => go("projects")}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-flag-red hover:gap-2.5 transition-all cursor-pointer"
                >
                  View project <ChevronRight size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ================= SHOWCASE (ADS) ================= */}
      {homeAds.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-fg/45">
              <Megaphone size={14} className="text-flag-red" /> Showcase — supported by partners & member businesses
            </p>
            <span className="hidden text-[11px] font-semibold text-fg/35 sm:block">Verified by Adom Circle</span>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {homeAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.link}
                onClick={(e) => {
                  if (ad.link === "#") e.preventDefault();
                  rpcClient.events.adClick({ adId: ad.id }).catch(() => {});
                }}
                className="group relative h-52 overflow-hidden rounded-3xl shadow-lg card-lift"
              >
                <img
                  src={ad.image}
                  alt={ad.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <Chip tone="gold" className="mb-2">{ad.sponsor}</Chip>
                  <p className="font-display text-lg font-bold leading-tight text-cream">{ad.title}</p>
                  <p className="mt-1 line-clamp-1 text-[12px] text-cream/70">{ad.tagline}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ================= UPCOMING EVENTS ================= */}
      {upcomingEvents.length > 0 && (
        <section id="events" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Mark your calendar"
              title={<>Upcoming <span className="text-flag-red">events</span></>}
            />
            <button
              onClick={() => go("events")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-flag-red hover:gap-2.5 transition-all cursor-pointer"
            >
              All events <ChevronRight size={15} />
            </button>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {upcomingEvents.map((e) => {
              const d = new Date(e.date);
              return (
                <Card key={e.id} hover className="flex items-center gap-4 p-5">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-ink text-cream">
                    <span className="font-display text-xl font-bold">{d.getDate()}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-flag-gold">
                      {d.toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold leading-snug">{e.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-fg/50">
                      {e.mode === "virtual" ? <Video size={12} className="text-flag-green" /> : <MapPin size={12} className="text-flag-green" />}
                      {e.location} · {e.attendeeCount} attending
                    </p>
                    <button
                      onClick={() => go("events")}
                      className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold text-flag-red hover:gap-2 transition-all cursor-pointer"
                    >
                      RSVP <ChevronRight size={13} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
          <button
            onClick={() => go("events")}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-fg/15 py-2.5 text-sm font-bold text-fg/60 hover:border-flag-red hover:text-flag-red transition-colors sm:hidden cursor-pointer"
          >
            See all events & activities <ChevronRight size={15} />
          </button>
        </section>
      )}

      {/* ================= FEATURED EVENTS CAROUSEL ================= */}
      {featuredEvents.length > 0 && (
        <section className="bg-soft py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Spotlight"
                title={<>Featured <span className="text-flag-red">events</span></>}
                sub="Hand-picked by the circle — hover or tap to pause, click to explore."
              />
              <button
                onClick={() => go("events")}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-flag-red hover:gap-2.5 transition-all cursor-pointer"
              >
                All events <ChevronRight size={15} />
              </button>
            </div>

            <div
              ref={carouselRef}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
              className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
            >
              {featuredEvents.map((e) => {
                const d = new Date(e.date);
                return (
                  <button
                    key={e.id}
                    onClick={() => go("events")}
                    className="group relative w-[300px] sm:w-[340px] shrink-0 snap-start overflow-hidden rounded-3xl text-left shadow-lg card-lift cursor-pointer"
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={e.image}
                        alt={e.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                      <Chip tone="gold" className="absolute left-3 top-3">
                        <Star size={11} /> Featured
                      </Chip>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-cream">
                        <span className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-ink/80 backdrop-blur">
                          <span className="font-display text-lg font-bold leading-none">{d.getDate()}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-flag-gold">
                            {d.toLocaleDateString("en-GB", { month: "short" })}
                          </span>
                        </span>
                        <span className="text-[13px] font-bold leading-tight">{e.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-card px-4 py-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg/55">
                        {e.mode === "virtual" ? <Video size={12} className="shrink-0 text-flag-green" /> : <MapPin size={12} className="shrink-0 text-flag-green" />}
                        <span className="truncate">{e.location}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-flag-red">
                        {e.attendeeCount} going →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= CIVIC PLEDGE ================= */}
      <section id="civic" className="relative scroll-mt-28 overflow-hidden bg-ink text-cream py-24">
        <div className="absolute inset-0">
          <img src="/output/images/civic.jpg" alt="Civic engagement" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/60" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">
              <Vote size={14} /> Civic & voting
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
              Peace is a gift. <span className="gold-gradient-text">Participation protects it.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-cream/70">
              Our peace, majority demographics and stability are not guaranteed forever.
              Christians and value-aligned citizens must stay engaged in civic life —
              register, learn the Constitution, and vote. Adom Circle is non-partisan, but never passive.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                variant="gold"
                onClick={() =>
                  user
                    ? (toast("Voter pledge recorded! 🇬🇭 Peace starts with you."), undefined)
                    : onAuth("signup")
                }
              >
                <Vote size={16} /> {t("pledge")}
              </Button>
              <Button variant="ghost" className="border border-cream/25 text-cream hover:bg-cream/10" onClick={() => go("civic")}>
                {t("learnConst")} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= VOICE FOR GHANA — THE WALL ================= */}
      <section id="voice-home" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Voice for Ghana"
            title={<>The wall to <span className="text-flag-red">Parliament</span></>}
            sub="One sentence. What would you ask our MPs and representatives to put forward, leaving no one behind? The best voices are featured and shared."
          />
          <Button variant="outline" className="shrink-0" onClick={goVoiceWall}>
            <Megaphone size={15} /> Add your voice <ArrowRight size={15} />
          </Button>
        </div>

        {wallSuggestions.length === 0 ? (
          <Card className="mt-10 p-12 text-center">
            <Megaphone size={28} className="mx-auto mb-3 text-flag-red" />
            <p className="font-display text-2xl font-bold">Be the first voice on the wall</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg/55">
              One sentence on what Ghana's representatives should put forward — schools, water, roads,
              jobs, healthcare. It takes 30 seconds to join and send yours.
            </p>
            <Button variant="dark" className="mt-6" onClick={goVoiceWall}>
              Send your suggestion <ArrowRight size={15} />
            </Button>
          </Card>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {wallSuggestions.slice(0, 3).map((s, i) => (
              <Card key={s.id} hover className="flex flex-col p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  {i === 0 ? (
                    <Chip tone="gold"><Star size={10} className="fill-current" /> Top voice</Chip>
                  ) : (
                    <Chip tone="green">On the wall</Chip>
                  )}
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-fg/50">
                    <ThumbsUp size={13} /> {s.upvotes.length}
                  </span>
                </div>
                <p className="flex-1 text-[15px] leading-relaxed text-fg/85">“{s.text}”</p>
                <p className="mt-4 border-t border-fg/8 pt-3 text-[12px] font-semibold text-fg/45">
                  {s.authorName} · {timeAgo(s.createdAt)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ================= COMMUNITY TEASER ================= */}
      <section id="community" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="A living community"
              title={<>Rooms where <span className="text-flag-red">Ghana talks.</span></>}
              sub="Discussion rooms, a full forum, and a respectful culture — moderated with fairness. From Youth & Education to Diaspora Corner, there's a circle for you."
            />
            <div className="mt-8 flex flex-wrap gap-2.5">
              {(rooms ?? []).slice(0, 8).map((r) => (
                <button key={r.id} onClick={() => go("community")} className="cursor-pointer">
                  <Chip tone="sand" className="px-4 py-2 text-sm hover:border-flag-red hover:text-flag-red transition-colors">
                    <span>{r.icon}</span> {r.name}
                  </Chip>
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <Button variant="dark" onClick={() => (user ? go("community") : onAuth("signup"))}>
                <MessageSquareHeart size={16} /> Join the conversation
              </Button>
              <p className="text-sm text-fg/50">
                <strong className="text-fg">+{formatNumber(stats?.volunteers ?? 3800)}</strong> active voices
              </p>
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold"># general</p>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-flag-green">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-flag-green" /> live
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["Ama Owusu", "Medase for joining! Where are you from? 🇬🇭", "now"],
                  ["Kofi Mensah", "Kumasi here — teacher & youth mentor. Happy to connect volunteers!", "2m"],
                  ["Yaw Adjei", "From Toronto, Nsawam at heart. Mentoring young devs back home.", "9m"],
                ].map(([name, text, time]) => (
                  <div key={name} className="rounded-2xl bg-soft/70 p-3.5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flag-green text-[10px] font-bold text-cream">
                        {name.split(" ").map((p) => p[0]).join("")}
                      </span>
                      <span className="text-xs font-bold">{name}</span>
                      <span className="text-[10px] text-fg/40">{time}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-fg/75">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-full border border-fg/10 bg-card px-4 py-2.5">
                <span className="text-sm text-fg/40">Join to send a message…</span>
              </div>
            </Card>
            <div className="absolute -bottom-5 -right-3 hidden sm:block animate-float">
              <LogoMark size={72} />
            </div>
          </div>
        </div>
      </section>

      {/* ================= LIVE ROOMS — see who's chatting now ================= */}
      {(rooms?.length ?? 0) > 0 && (
        <section className="bg-soft py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Live now"
                title={<>Rooms with <span className="text-flag-green">people in them</span></>}
                sub="See which conversations are busy right now and jump straight in."
              />
              <Button variant="outline" className="shrink-0" onClick={() => go("community")}>
                Open all rooms <ArrowRight size={15} />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms!.slice(0, 8).map((r) => {
                const n = liveRooms[r.id] ?? 0;
                const busy = n > 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => joinRoom(r.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-left transition-all cursor-pointer",
                      busy
                        ? "border-flag-green/40 shadow-sm hover:border-flag-green hover:shadow-md"
                        : "border-fg/10 hover:border-fg/30",
                    )}
                  >
                    <span className="text-xl">{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.name}</span>
                    <span className={cn("mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold", busy ? "text-flag-green" : "text-fg/40")}>
                      <span className={cn("h-2 w-2 rounded-full", busy ? "animate-pulse-soft bg-flag-green" : "bg-fg/20")} />
                      {busy
                        ? r.maxUsers
                          ? `${n}/${r.maxUsers} ${n === 1 ? "person" : "people"} chatting`
                          : `${n} ${n === 1 ? "person" : "people"} chatting`
                        : "Quiet right now"}
                      {r.maxUsers && n >= r.maxUsers && (
                        <span className="rounded-full bg-flag-red/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-flag-red">full</span>
                      )}
                    </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-bold text-cream">
                      {busy ? "Join chat" : "Start chat"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= STORIES / NEWS ================= */}
      <section id="stories" className="scroll-mt-28 bg-soft py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="From the circle"
              title={<>Stories & <span className="text-flag-red">updates</span></>}
            />
            <Button variant="outline" className="shrink-0" onClick={() => go("blog")}>
              Read the blog <ArrowRight size={15} />
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(posts ?? []).slice(0, 3).map((post) => (
              <Card key={post.id} hover className="overflow-hidden">
                <div className="relative h-48 overflow-hidden">
                  <img src={post.image} alt={post.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                  <Chip tone="red" className="absolute left-3 top-3">{post.category}</Chip>
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                    {post.author} · {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 font-display text-lg font-bold leading-snug">{post.title}</p>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-fg/60">{post.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOT CONVERSATIONS ================= */}
      {hotThreads.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Happening now"
            title={<>Hot <span className="text-flag-red">conversations</span></>}
            sub="The most engaged discussions across the circle this fortnight — jump in or share them with your network."
            className="mb-12"
          />
          <div className="grid gap-6 md:grid-cols-3">
            {hotThreads.map((t, i) => {
              const share = shareThread(t.title, t.authorName);
              return (
                <Card key={t.id} hover className="flex flex-col p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-flag-red">
                      <Flame size={14} className="fill-flag-red/20" /> #{i + 1} hot
                    </span>
                    <span className="text-[11px] font-semibold text-fg/40">{timeAgo(t.createdAt)}</span>
                  </div>
                  <button onClick={() => go("community")} className="text-left cursor-pointer">
                    <h3 className="font-display text-lg font-bold leading-snug hover:text-flag-red transition-colors line-clamp-2">
                      {t.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-fg/60">{t.body}</p>
                  </button>
                  <div className="mt-4 flex items-center gap-3 text-[12px] font-semibold text-fg/50">
                    <span className="flex items-center gap-1"><Users size={13} /> {t.authorName}</span>
                    <span className="flex items-center gap-1"><ThumbsUp size={13} /> {t.likes}</span>
                    <span className="flex items-center gap-1"><MessageSquareHeart size={13} /> {t.replyCount}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-fg/8 pt-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg/35">Share</span>
                    <a
                      href={share.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Share on WhatsApp"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-flag-green/10 text-flag-green hover:bg-flag-green hover:text-cream transition-colors"
                    >
                      <WhatsAppIcon size={15} />
                    </a>
                    <a
                      href={share.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Share on Facebook"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-cream transition-colors"
                    >
                      <FacebookIcon size={15} />
                    </a>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText("https://adomcircle.org/community");
                          toast("Link copied — paste it anywhere to share");
                        } catch {
                          toast("Couldn't copy", "error");
                        }
                      }}
                      title="Copy link"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-fg/60 hover:bg-ink hover:text-cream transition-colors cursor-pointer"
                    >
                      <Link2 size={15} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= STAY CONNECTED EVERYWHERE ================= */}
      {(settings?.socials ?? []).some((s) => s.url && s.url !== "#") && (
        <section id="connect" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Join us everywhere"
            title={<>One circle, <span className="text-flag-red">every channel.</span></>}
            sub="Follow, watch and share on your favourite platform — the conversation continues beyond the site."
            className="mb-12"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SOCIAL_BRANDS.map((brand) => {
              const link = (settings?.socials ?? []).find(
                (s) => s.platform === brand.platform && s.url && s.url !== "#",
              );
              if (!link) return null;
              return (
                <a
                  key={brand.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-3xl p-6 text-cream shadow-lg card-lift"
                  style={{ background: brand.bg }}
                >
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150" />
                  <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-black/10" />
                  <brand.icon size={30} className="relative" />
                  <p className="relative mt-5 font-display text-xl font-bold leading-tight">{brand.title}</p>
                  <p className="relative mt-1 text-[13px] text-cream/75">{brand.tagline}</p>
                  <span className="relative mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold backdrop-blur transition-colors duration-300 group-hover:bg-white group-hover:text-ink">
                    Join us <ArrowRight size={13} />
                  </span>
                </a>
              );
            })}
          </div>
          <p className="mt-6 text-center text-[12px] text-fg/45">
            Links managed in Admin → Site content → Social & community links.
          </p>
        </section>
      )}

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-flag-green text-cream py-24">
        <div className="absolute inset-0">
          <img src="/output/images/community.jpg" alt="Ghanaian community" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-flag-green/60" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-6 flex justify-center">
            <LogoMark size={76} />
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
            Ghana is calling. <span className="gold-gradient-text">Answer in a circle.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-cream/80">
            Join thousands of Ghanaians at home and abroad — contribute, invest, learn,
            discuss, and help keep our nation peaceful and prosperous.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Button variant="gold" className="px-8 py-3.5 text-base" onClick={() => (user ? go("community") : onAuth("signup"))}>
              {t("join")} <ArrowRight size={18} />
            </Button>
            <Button variant="ghost" className="border border-cream/30 px-8 py-3.5 text-base text-cream hover:bg-cream/10" onClick={() => go("about")}>
              {t("values")}
            </Button>
          </div>
          <div className="mt-10 flex items-center justify-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-cream/60">
            <span className="flex items-center gap-1.5"><CalendarDays size={13} /> Non-partisan</span>
            <span className="flex items-center gap-1.5"><Scale size={13} /> Constitution above all</span>
            <span className="flex items-center gap-1.5"><HeartHandshake size={13} /> Peaceful & constructive</span>
          </div>
        </div>
      </section>
      {/* ================= REGION DETAIL MODAL ================= */}
      <Modal open={!!region} onClose={() => setRegion(null)} wide>
        {region && (
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
                  <MapPin size={13} /> {region.capital} · Ghana
                </p>
                <h2 className="font-display text-3xl font-bold">{region.name} Region</h2>
              </div>
              <span className="flag-stripes mt-1 h-[4px] w-16 shrink-0 rounded-full" aria-hidden />
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg/50">
                  <HandHeart size={15} className="text-flag-green" /> Projects here
                </p>
                {(heroProjects ?? []).filter((p) => p.region === region.id).length === 0 ? (
                  <p className="rounded-2xl bg-soft px-4 py-3 text-[13px] text-fg/55">
                    No active projects yet — be the first to start one in {region.name}. 🇬🇭
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {(heroProjects ?? [])
                      .filter((p) => p.region === region.id)
                      .slice(0, 4)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => go("projects")}
                          className="flex w-full items-center gap-3 rounded-2xl border border-fg/8 bg-card p-3 text-left transition-colors hover:border-flag-green/50 cursor-pointer"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flag-green/10 text-flag-green">
                            {THEME_ICONS[p.theme]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">{p.title}</span>
                            <span className="block text-[11px] text-fg/45">
                              {p.volunteers} volunteers · {formatNumber(p.hours)} hrs
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg/50">
                  <CalendarDays size={15} className="text-flag-red" /> Events here
                </p>
                {(events ?? []).filter((e) => e.region === region.id && e.date >= new Date().toISOString()).length === 0 ? (
                  <p className="rounded-2xl bg-soft px-4 py-3 text-[13px] text-fg/55">
                    Nothing scheduled in {region.name} yet — check back soon.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {(events ?? [])
                      .filter((e) => e.region === region.id && e.date >= new Date().toISOString())
                      .slice(0, 4)
                      .map((e) => (
                        <button
                          key={e.id}
                          onClick={() => go("events")}
                          className="flex w-full items-center gap-3 rounded-2xl border border-fg/8 bg-card p-3 text-left transition-colors hover:border-flag-red/50 cursor-pointer"
                        >
                          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-cream">
                            <span className="font-display text-sm font-bold leading-none">
                              {new Date(e.date).getDate()}
                            </span>
                            <span className="text-[8px] font-semibold uppercase text-flag-gold">
                              {new Date(e.date).toLocaleDateString("en-GB", { month: "short" })}
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">{e.title}</span>
                            <span className="block text-[11px] text-fg/45">
                              {e.location} · {e.attendeeCount} going
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-flag-gold/30 bg-gold-soft/20 px-4 py-3">
              <p className="text-[13px] text-fg/70">
                From <strong>{region.capital}</strong> to the world — {region.name} members are in the circle.
                Join the conversation and keep your region visible.
              </p>
              <Button variant="dark" onClick={() => { setRegion(null); go("community"); }}>
                Join the discussion <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ValueIcon({ icon }: { icon: string }) {
  const map: Record<string, React.ReactNode> = {
    scale: <Scale size={22} />,
    dove: <Handshake size={22} />,
    heart: <HeartHandshake size={22} />,
    trending: <TrendingUp size={22} />,
    vote: <Star size={22} />,
  };
  return map[icon] ?? <Star size={22} />;
}

/* ------------------------------------------------------------------ */
/* Meet the Circle — a slim rolling strip of member avatars embedded   */
/* in the hero (visible to visitors before they join). Each avatar     */
/* shows online/offline; tapping opens a small, privacy-light card     */
/* with only where they are (region/diaspora), denomination (if given) */
/* and status. First name is shown on hover/tap via the title.         */
/* ------------------------------------------------------------------ */

type DirEntry = Awaited<ReturnType<typeof rpcClient.members.directory>>[number];

function MembersMarquee({
  members,
  user,
  onAuth,
}: {
  members: DirEntry[];
  user: PublicMember | null;
  onAuth: (m: "login" | "signup") => void;
}) {
  const [peek, setPeek] = useState<DirEntry | null>(null);
  const [fullId, setFullId] = useState<string | null>(null);

  const showOnline = members.filter((m) => m.online).length;

  return (
    <>
      <div className="text-cream">
        {/* Slim caption — reads as a live social proof line, not a big heading */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-cream/55">
            <span className="flag-stripes h-[3px] w-6 rounded-full" aria-hidden />
            Meet the Circle
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cream/45">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flag-green opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flag-green" />
            </span>
            {showOnline} online now
          </span>
        </div>

        {/* Rolling avatars — two copies for a seamless loop; pauses on hover */}
        <div className="group relative mt-3 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-ink to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-ink to-transparent"
            aria-hidden
          />
          <div className="flex w-max animate-marquee gap-3 pr-3 group-hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex gap-3">
                {members.map((m) => (
                  <button
                    key={`${m.id}-${copy}`}
                    onClick={() => setPeek(m)}
                    className="group/av relative block h-12 w-12 shrink-0 cursor-pointer rounded-full"
                    title={`${m.name} — ${m.online ? "Online now" : "Offline"}`}
                    aria-label={`${m.name}, ${m.online ? "online" : "offline"}`}
                  >
                    <Avatar
                      name={m.name}
                      size={48}
                      src={m.avatarImage}
                      className="ring-2 ring-cream/20 transition-all duration-200 group-hover/av:ring-flag-gold group-hover/av:shadow-glow-gold"
                    />
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-ink",
                        m.online ? "bg-flag-green" : "bg-cream/25",
                      )}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Peek — minimal, privacy-light details (region/diaspora, denomination, status) */}
      {peek && (
        <Modal open onClose={() => setPeek(null)}>
          <div className="p-6 text-center sm:p-8">
            <Avatar name={peek.name} size={76} className="mx-auto ring-4 ring-flag-gold" src={peek.avatarImage} />
            <p className="mt-3 font-display text-xl font-bold">{peek.name}</p>
            <p className={cn("mt-1 inline-flex items-center gap-1.5 text-[12px] font-bold", peek.online ? "text-flag-green" : "text-fg/45")}>
              <span className={cn("h-2 w-2 rounded-full", peek.online ? "bg-flag-green" : "bg-fg/25")} />
              {peek.online ? "Online now" : peek.lastSeenAt ? `Last seen ${timeAgo(peek.lastSeenAt)}` : "Offline"}
            </p>

            {(peek.region || peek.diasporaCountry || peek.church) && (
              <div className="mt-5 space-y-2 text-left">
                {peek.region && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-soft/60 px-3.5 py-2.5">
                    <MapPin size={14} className="shrink-0 text-flag-red" />
                    <span className="text-[12px] font-bold uppercase tracking-wider text-fg/45">Region</span>
                    <span className="ml-auto text-[13px] font-semibold text-fg/85">{regionName(peek.region)}</span>
                  </div>
                )}
                {peek.diasporaCountry && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-soft/60 px-3.5 py-2.5">
                    <span className="shrink-0 text-[13px]">📍</span>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-fg/45">Diaspora</span>
                    <span className="ml-auto text-[13px] font-semibold text-fg/85">{peek.diasporaCountry}</span>
                  </div>
                )}
                {peek.church && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-soft/60 px-3.5 py-2.5">
                    <span className="shrink-0 text-[13px]">⛪</span>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-fg/45">Denomination</span>
                    <span className="ml-auto text-[13px] font-semibold text-fg/85">{peek.church}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-2">
              {!user ? (
                <>
                  <Button variant="gold" className="w-full" onClick={() => { setPeek(null); onAuth("signup"); }}>
                    Join the circle 🇬🇭
                  </Button>
                  <Button variant="ghost" className="w-full text-fg/50" onClick={() => { setPeek(null); onAuth("login"); }}>
                    Already a member? Sign in
                  </Button>
                </>
              ) : peek.id === user.id ? (
                <p className="text-[12px] font-semibold text-fg/45">This is you — the circle sees you here 🟢</p>
              ) : (
                <Button variant="dark" className="w-full" onClick={() => { setFullId(peek.id); setPeek(null); }}>
                  View full profile <ArrowRight size={15} />
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Full member profile (logged-in visitors) */}
      <MemberModal memberId={fullId} open={!!fullId} onClose={() => setFullId(null)} />
    </>
  );
}
