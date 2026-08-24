import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Landmark,
  Vote,
  CalendarDays,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Megaphone,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, SectionHeading } from "./ui";
import { LogoMark } from "@/client/lib/logo";
import { cn } from "@/client/lib/format";

const FACTS = [
  {
    icon: Landmark,
    title: "The Constitution is supreme",
    body: "Article 1(2) of the Constitution of Ghana establishes that the Constitution is the supreme law of the land — above any denomination, institution or group. This single clause protects our peace.",
  },
  {
    icon: BookOpen,
    title: "Freedom of worship, protected",
    body: "Ghana guarantees religious freedom for all. Our historic Christian majority and strong traditional values shaped our peace — and the Constitution protects every Ghanaian's right to worship.",
  },
  {
    icon: Vote,
    title: "Your vote is your voice",
    body: "Peace, majority demographics and stability are not guaranteed forever. Registering and voting keeps values-aligned citizens engaged in shaping who leads Ghana.",
  },
  {
    icon: ShieldCheck,
    title: "Peaceful transfer of power",
    body: "Ghana is a beacon of peaceful elections in Africa. Protecting this legacy means participating — and demanding leaders who uphold the Constitution above all.",
  },
];

const TIMELINE = [
  { title: "Voter registration", desc: "Check your registration status at any district office or with the EC's online tools.", date: "Ongoing" },
  { title: "National elections", desc: "Ghana's next general election — register early, verify your details, and vote.", date: "7 Dec 2028" },
  { title: "Stay engaged", desc: "Follow civic education posts in the circle and join the Civic & Voting room.", date: "Always" },
];

export function Civic() {
  const { user, toast, requireUser } = useStore();
  const [pledged, setPledged] = useState(false);

  const { data: me } = useQuery(
    queryClient.members.byId.queryOptions({
      input: user?.id ?? "",
      enabled: !!user,
    }),
  );

  const pledge = useMutation(
    queryClient.members.pledge.mutationOptions({
      onSuccess: () => {
        toast("Pledge recorded — peace starts with you 🇬🇭");
        setPledged(true);
      },
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );

  const currentUser = user;
  const hasPledged = me?.pledgeVote ?? pledged;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cream pt-32 pb-20">
        <div className="absolute inset-0">
          <img src="/output/images/civic.jpg" alt="Civic engagement" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">
            <Landmark size={14} /> Civic & voting awareness
          </p>
          <h1 className="max-w-2xl font-display text-4xl sm:text-6xl font-bold leading-tight">
            Know the Constitution. <span className="gold-gradient-text">Keep the peace.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-cream/70">
            Non-partisan civic education for every Ghanaian. We never endorse parties —
            we empower citizens to participate, understand, and protect what we've built.
          </p>

          {/* Pledge card */}
          <div className="mt-10 max-w-xl rounded-3xl border border-flag-gold/40 bg-card/5 p-6 backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-flag-gold p-3 text-fg">
                <Vote size={22} />
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-bold">The Voter's Pledge</p>
                <p className="mt-1 text-sm text-cream/70">
                  “I intend to vote in Ghana's elections. No party preference is recorded —
                  only my commitment to participate in protecting our peace.”
                </p>
                {hasPledged ? (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-flag-green/20 px-4 py-2 text-sm font-bold text-emerald-300">
                    <CheckCircle2 size={16} /> You've pledged to vote — thank you!
                  </p>
                ) : (
                  <Button
                    variant="gold"
                    className="mt-4"
                    disabled={pledge.isPending}
                    onClick={() => {
                      if (!currentUser) return toast("Join the circle first — it takes 30 seconds", "error");
                      pledge.mutate({ id: currentUser.id, pledge: true });
                    }}
                  >
                    {pledge.isPending ? <Loader2 size={16} className="animate-spin" /> : <Vote size={16} />}
                    I intend to vote
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Learn"
          title={<>Four things every <span className="text-flag-red">citizen</span> should know.</>}
          className="mb-12"
        />
        <div className="grid gap-5 md:grid-cols-2">
          {FACTS.map((f) => (
            <Card key={f.title} hover className="p-6">
              <div className="mb-3 inline-flex rounded-2xl bg-ink p-3 text-flag-gold">
                <f.icon size={20} />
              </div>
              <p className="font-display text-lg font-bold">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg/60">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Key dates"
                title={<>Election timeline <span className="text-flag-green">at a glance.</span></>}
                sub="Registration, campaigns, voting — know the dates, plan your participation."
              />
              <div className="mt-8 space-y-4">
                {TIMELINE.map((t, i) => (
                  <div key={t.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-flag-gold font-display font-bold">
                        {i + 1}
                      </div>
                      {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-ink/15" />}
                    </div>
                    <div className="pb-6">
                      <p className="flex items-center gap-2 font-bold">
                        <CalendarDays size={15} className="text-flag-red" /> {t.title}
                        <Chip tone="green">{t.date}</Chip>
                      </p>
                      <p className="mt-1 text-sm text-fg/60">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="overflow-hidden">
              <div className="relative h-64">
                <img src="/output/images/hero.jpg" alt="Ghana" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-page px-4 py-2 text-sm font-bold text-fg">
                  <Megaphone size={15} className="text-flag-red" /> Non-partisan. Always.
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm leading-relaxed text-fg/70">
                  Adom Circle never endorses candidates or parties. We advocate for the
                  Constitution, for participation, and for leaders who uphold values —
                  so you can vote your conscience, in peace.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-flag-green">
                  <ShieldCheck size={14} /> Community guidelines: no hate speech · no incitement · respect for all faiths
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Constitution quote */}
      <section className="bg-flag-green py-20 text-cream">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-6 flex justify-center">
            <LogoMark size={64} />
          </div>
          <blockquote className="font-display text-2xl sm:text-3xl font-bold leading-snug">
            “The Sovereignty of Ghana resides in the people of Ghana in whose name and
            for whose welfare the powers of government are to be exercised.”
          </blockquote>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-cream/70">
            — Constitution of the Republic of Ghana, 1992
          </p>
        </div>
      </section>
    </div>
  );
}
