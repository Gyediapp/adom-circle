import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Store,
  Landmark,
  Users,
  PiggyBank,
  ArrowRight,
  CheckCircle2,
  Globe2,
  Briefcase,
} from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, SectionHeading } from "./ui";
import { LogoMark } from "@/client/lib/logo";
import type { Tab } from "./navbar";

const PATHS = [
  {
    icon: Store,
    title: "Start or grow a business",
    body: "Register a company, access the Ghana Enterprises Agency, and find funding options for SMEs. Practical guides written by members who've done it.",
    tag: "Entrepreneurs",
  },
  {
    icon: PiggyBank,
    title: "Invest responsibly",
    body: "Treasury bills, mutual funds, real estate, farmland partnerships and diaspora bonds — learn the risk profile of each before you commit.",
    tag: "Investors",
  },
  {
    icon: Globe2,
    title: "Remit & support home",
    body: "Send money with the lowest fees, fund family projects, and pool remittances with fellow diaspora members for community projects.",
    tag: "Diaspora",
  },
  {
    icon: Briefcase,
    title: "Buy Ghanaian",
    body: "Patronise local products, connect with member-owned businesses in our directory, and join 'Support a Ghanaian business' campaigns.",
    tag: "Everyone",
  },
];

const PRINCIPLES = [
  "Support businesses that pay fair wages and respect workers",
  "Verify before you invest — we fight scams with education",
  "Prefer Ghanaian products and services when quality allows",
  "Reinvest a share of earnings into community projects",
  "Remittances should build assets, not just consumption",
];

export function Economy({ onTab }: { onTab: (t: Tab) => void }) {
  const { user } = useStore();
  const { data: posts } = useQuery(queryClient.posts.list.queryOptions());
  const econPosts = (posts ?? []).filter((p) => p.category === "Economy").slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cream pt-32 pb-20">
        <div className="absolute inset-0">
          <img src="/output/images/economy.jpg" alt="Ghanaian economy" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">
            <TrendingUp size={14} /> Economic participation hub
          </p>
          <h1 className="max-w-2xl font-display text-4xl sm:text-6xl font-bold leading-tight">
            Build, invest & buy <span className="gold-gradient-text">Ghanaian.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-cream/70">
            A nation grows when its people participate. Whether you're at home or abroad,
            here's how to plug into the Ghanaian economy — responsibly and together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Chip tone="gold" className="px-4 py-2 text-sm"><Landmark size={14} /> 14 diaspora countries</Chip>
            <Chip tone="gold" className="px-4 py-2 text-sm"><Store size={14} /> 1,200+ member businesses</Chip>
            <Chip tone="gold" className="px-4 py-2 text-sm"><Users size={14} /> SME funds & partnerships</Chip>
          </div>
        </div>
      </section>

      {/* Paths */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Four ways in"
          title={<>Participate in <span className="text-flag-green">the Ghanaian economy.</span></>}
          sub="Curated by members and partners — churches, NGOs and businesses aligned with our values."
          className="mb-12"
        />
        <div className="grid gap-5 md:grid-cols-2">
          {PATHS.map((p) => (
            <Card key={p.title} hover className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-2xl bg-ink p-3 text-flag-gold">
                  <p.icon size={22} />
                </div>
                <Chip tone="green">{p.tag}</Chip>
              </div>
              <p className="font-display text-xl font-bold">{p.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg/60">{p.body}</p>
              <button
                onClick={() => onTab("community")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-flag-red hover:gap-2.5 transition-all cursor-pointer"
              >
                Discuss in Business & Economy <ArrowRight size={15} />
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="bg-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1">
              <Card className="overflow-hidden">
                <div className="relative h-64">
                  <img src="/output/images/economy.jpg" alt="Local market" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-page px-4 py-2 text-sm font-bold text-fg">
                    <Store size={15} className="text-flag-green" /> Buy Ghanaian, build Ghana
                  </div>
                </div>
                <div className="p-6">
                  <p className="font-display text-lg font-bold">Responsible participation principles</p>
                  <ul className="mt-3 space-y-2.5">
                    {PRINCIPLES.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-fg/70">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-flag-green" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
            <div className="order-1 lg:order-2">
              <SectionHeading
                eyebrow="With integrity"
                title={<>Grow wealth, <span className="text-flag-red">not greed.</span></>}
                sub="Economic participation strengthens families and communities. We promote honest business, financial literacy and zero tolerance for get-rich-quick schemes."
              />
              <div className="mt-8 flex items-center gap-4">
                <LogoMark size={52} />
                <p className="max-w-sm text-sm text-fg/55">
                  Members who invest in Ghana, run businesses and support local products earn
                  the <strong className="text-fg">Economic Participant</strong> badge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Posts */}
      {econPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Money moves" title={<>Latest on <span className="text-flag-green">the economy</span></>} className="mb-10" />
          <div className="grid gap-6 md:grid-cols-3">
            {econPosts.map((p) => (
              <Card key={p.id} hover className="overflow-hidden">
                <div className="relative h-40">
                  <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                  <Chip tone="red" className="absolute left-3 top-3">Economy</Chip>
                </div>
                <div className="p-5">
                  <p className="font-display text-base font-bold leading-snug">{p.title}</p>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-fg/60">{p.body}</p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-fg/40">By {p.author}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button variant="dark" onClick={() => (user ? onTab("community") : onTab("home"))}>
              Connect with member businesses <ArrowRight size={16} />
            </Button>
            <Button variant="outline" onClick={() => onTab("projects")}>
              See economic projects
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
