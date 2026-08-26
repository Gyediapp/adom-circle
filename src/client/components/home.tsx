import { useMemo } from "react";
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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { useI18n } from "@/client/lib/i18n";
import { SocialLinks } from "./socials";
import { FacebookIcon, WhatsAppIcon, YouTubeIcon, TikTokIcon } from "@/client/lib/brand-icons";
import { Button, Card, Chip, SectionHeading, Stat, ProgressBar } from "./ui";
import { LogoMark, Star } from "@/client/lib/logo";
import { GHANA_REGIONS } from "@/server/data/regions";
import { formatNumber } from "@/client/lib/format";
import type { Tab } from "./navbar";

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
  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { data: ads } = useQuery(queryClient.events.adsPublic.queryOptions());
  const { data: events } = useQuery(queryClient.events.list.queryOptions());

  const stats = settings?.stats;

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

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-cream">
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

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pb-24 pt-32 sm:px-6">
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
              <Star size={12} className="text-flag-gold" />
              <span className="text-flag-gold">One Ghana</span>
              <Star size={12} className="text-flag-red" />
              <span className="text-cream/75">Peace</span>
              <Star size={12} className="text-flag-gold" />
              <span className="text-flag-gold">Progress</span>
              <Star size={12} className="text-flag-green" />
              <span className="text-cream/75">Constitution Above All</span>
              <Star size={12} className="text-flag-gold" />
              <span className="text-flag-gold">16 Regions</span>
              <Star size={12} className="text-flag-red" />
              <span className="text-cream/75">Black Star Forever</span>
              <Star size={12} className="text-flag-green" />
            </div>
          ))}
        </div>
        <div className="flag-stripes h-[3px] w-full" aria-hidden />
      </div>

      {/* ================= MISSION / VALUES ================= */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
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
      <section className="bg-ink text-cream py-24">
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
                  <div key={r.id} className="rounded-xl border border-white/10 bg-card/5 px-3 py-2">
                    <p className="text-[13px] font-bold">{r.name}</p>
                    <p className="text-[11px] text-cream/50">{r.capital}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-cream/60">
                From Nalerigu to Sekondi, Ho to Wa — members in every corner of the country,
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
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
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
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
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

      {/* ================= CIVIC PLEDGE ================= */}
      <section className="relative overflow-hidden bg-ink text-cream py-24">
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

      {/* ================= COMMUNITY TEASER ================= */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
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

      {/* ================= STORIES / NEWS ================= */}
      <section className="bg-soft py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="From the circle"
            title={<>Stories & <span className="text-flag-red">updates</span></>}
            className="mb-12"
          />
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

      {/* ================= STAY CONNECTED EVERYWHERE ================= */}
      {(settings?.socials ?? []).some((s) => s.url && s.url !== "#") && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
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
