import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, Landmark, Scale, Users, Globe2, ShieldCheck } from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { Card, Chip, SectionHeading } from "./ui";
import { LogoMark } from "@/client/lib/logo";
import { GHANA_REGIONS } from "@/server/data/regions";

const PILLARS = [
  {
    icon: Landmark,
    title: "Constitution above all",
    body: "The Constitution of Ghana is supreme over any denomination, institution or group. Every member accepts and abides by it.",
  },
  {
    icon: Scale,
    title: "Religious freedom & coexistence",
    body: "We respect religious freedom and peaceful coexistence, while valuing the historic role of Christian and traditional values in Ghana's peace.",
  },
  {
    icon: HeartHandshake,
    title: "Social contribution",
    body: "We track and showcase real development contributions to the Motherland — time, skills, resources and financial support.",
  },
  {
    icon: Globe2,
    title: "Economic participation",
    body: "We encourage members to invest, build and buy Ghanaian — strengthening the economy from home and abroad.",
  },
  {
    icon: ShieldCheck,
    title: "Civic engagement",
    body: "Peace is not guaranteed forever. We encourage every citizen to register, vote, and stay engaged in civic life.",
  },
  {
    icon: Users,
    title: "Everyone is welcome",
    body: "Every Ghanaian — and Ghana-connected person — who accepts the Constitution and peaceful coexistence is welcome.",
  },
];

const GUIDELINES = [
  "The Constitution of Ghana is supreme — above any denomination, institution or group.",
  "No hate speech, no religious or ethnic incitement — ever.",
  "Respectful disagreement is welcome; personal attacks are not.",
  "Respect the religious freedom of every Ghanaian.",
  "Focus on values, peace and constitutional order — not on dividing people.",
  "Report content that violates these guidelines; moderators act fairly and quickly.",
];

export function About() {
  const { data: settings } = useQuery(queryClient.site.get.queryOptions());

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cream pt-32 pb-20">
        <div className="absolute inset-0">
          <img src="/output/images/community.jpg" alt="Community" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-8 flex justify-center">
            <LogoMark size={92} />
          </div>
          <h1 className="mx-auto max-w-3xl text-center font-display text-4xl sm:text-6xl font-bold leading-tight">
            One Circle. <span className="gold-gradient-text">One Ghana.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-cream/75">
            Adom Circle is a civic, social and values-driven initiative for Ghanaians at
            home and abroad — anchored on contribution, economic participation, civic duty,
            and the supremacy of the Constitution of Ghana.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Chip tone="gold" className="px-4 py-2 text-sm">16 regions</Chip>
            <Chip tone="gold" className="px-4 py-2 text-sm">14 diaspora countries</Chip>
            <Chip tone="gold" className="px-4 py-2 text-sm">Churches · NGOs · Businesses</Chip>
          </div>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-8 border-t-4 border-t-flag-red">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-flag-red">Our mission</p>
            <p className="mt-3 font-display text-xl leading-relaxed">{settings?.mission}</p>
          </Card>
          <Card className="p-8 border-t-4 border-t-flag-green">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-flag-green">Our vision</p>
            <p className="mt-3 font-display text-xl leading-relaxed">{settings?.vision}</p>
          </Card>
        </div>
      </section>

      {/* Pillars */}
      <section className="bg-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="What we stand for"
            title={<>Six pillars of <span className="text-flag-red">the circle.</span></>}
            className="mb-12"
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <Card key={p.title} hover className="p-6">
                <div className="mb-3 inline-flex rounded-2xl bg-ink p-3 text-flag-gold">
                  <p.icon size={20} />
                </div>
                <p className="font-display text-lg font-bold">{p.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-fg/60">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Guidelines */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Community guidelines"
              title={<>How we keep it <span className="text-flag-green">peaceful.</span></>}
              sub="Moderation is not censorship — it's protecting the circle so every Ghanaian can speak with respect."
            />
            <ul className="mt-8 space-y-3">
              {GUIDELINES.map((g) => (
                <li key={g} className="flex items-start gap-3 rounded-2xl bg-card border border-fg/5 px-4 py-3 text-sm leading-relaxed text-fg/70">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-flag-red" /> {g}
                </li>
              ))}
            </ul>
          </div>
          <Card className="overflow-hidden">
            <div className="p-6 bg-ink text-cream">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">Who can join</p>
              <p className="mt-3 text-sm leading-relaxed text-cream/80">
                Every Ghanaian — and Ghana-connected person — who:
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  "Accepts and abides by the Constitution of Ghana.",
                  "Recognises the Constitution is above any denomination, institution or group.",
                  "Respects religious freedom and peaceful coexistence.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-cream/75">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-flag-gold" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-fg/40">All 16 regions in the circle</p>
              <div className="grid grid-cols-2 gap-1.5">
                {GHANA_REGIONS.map((r) => (
                  <span key={r.id} className="rounded-lg bg-soft/70 px-2.5 py-1.5 text-[12px] font-semibold text-fg/70">
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
