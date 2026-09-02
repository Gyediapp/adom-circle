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
  ThumbsUp,
  Share2,
  Sparkles,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Chip, SectionHeading } from "./ui";
import { LogoMark, Star } from "@/client/lib/logo";
import { cn, timeAgo, initials, avatarColor } from "@/client/lib/format";
import { ShareModal, type ShareTarget } from "./share-modal";

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

  // Voice for Ghana
  const [suggestionText, setSuggestionText] = useState("");
  const { data: suggestionsList = [] } = useQuery(
    queryClient.suggestions.list.queryOptions(),
  );
  const submitSuggestion = useMutation(
    queryClient.suggestions.submit.mutationOptions({
      onSuccess: () => {
        toast("Suggestion sent! It will appear once approved. 🇬🇭");
        setSuggestionText("");
      },
      onError: (e: any) => toast(e?.message ?? "Failed to send", "error"),
    }),
  );
  const upvoteSuggestion = useMutation(
    queryClient.suggestions.upvote.mutationOptions({
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );

  // Share dialog for individual voices on the wall
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  // Wall social proof — totals computed from the approved list
  const wallVoices = suggestionsList.length;
  const wallUpvotes = suggestionsList.reduce((sum, s) => sum + s.upvotes.length, 0);
  const wallFeatured = suggestionsList.filter((s) => s.featured).length;

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

      {/* Voice for Ghana — the wall (prominent, right under the hero) */}
      <section id="voice" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="The people's wall"
            title={<>Voice for <span className="text-flag-green">Ghana</span></>}
            sub="One sentence. What would you ask our MPs and representatives to put forward, leaving no one behind? Approved voices are featured and shared."
          />
          {/* Social proof */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-fg/10 bg-card px-4 py-2.5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flag-red/10 text-flag-red">
                <Megaphone size={15} />
              </span>
              <div className="leading-tight">
                <p className="font-display text-lg font-bold leading-none">{wallVoices}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg/45">Voices</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-fg/10 bg-card px-4 py-2.5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flag-green/10 text-flag-green">
                <ThumbsUp size={15} />
              </span>
              <div className="leading-tight">
                <p className="font-display text-lg font-bold leading-none">{wallUpvotes}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg/45">Upvotes</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-fg/10 bg-card px-4 py-2.5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flag-gold/20 text-gold-deep">
                <Star size={15} />
              </span>
              <div className="leading-tight">
                <p className="font-display text-lg font-bold leading-none">{wallFeatured}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg/45">Featured</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">
          {/* Submit box */}
          <Card className="h-fit overflow-hidden p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-b from-flag-red to-[#a80d1e] text-cream shadow-lg shadow-flag-red/25">
                <Megaphone size={18} />
              </span>
              <div>
                <p className="font-display text-lg font-bold leading-tight">Send your voice</p>
                <p className="text-[11px] font-semibold text-fg/45">One sentence · under 280 characters</p>
              </div>
            </div>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="e.g. Invest in boreholes for rural schools so no child walks 4km for water."
              rows={4}
              maxLength={280}
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-fg/40">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-flag-gold" /> Reviewed by moderators
              </span>
              <span className={cn(suggestionText.trim().length > 260 && "text-flag-red")}>
                {suggestionText.trim().length}/280
              </span>
            </div>
            <Button
              variant="dark"
              className="mt-3 w-full"
              disabled={submitSuggestion.isPending || suggestionText.trim().length < 10}
              onClick={() => {
                if (!currentUser) return toast("Join the circle first — it takes 30 seconds", "error");
                submitSuggestion.mutate({ memberId: currentUser.id, text: suggestionText.trim() });
              }}
            >
              {submitSuggestion.isPending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
              Send to the wall
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-fg/45">
              <ShieldCheck size={12} className="text-flag-green" /> One per day · approved before it appears
            </p>
          </Card>

          {/* The wall */}
          <div className="space-y-4">
            {suggestionsList.length === 0 && (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-flag-gold/15 text-gold-deep">
                  <Megaphone size={28} />
                </span>
                <p className="font-display text-xl font-bold">The wall is waiting for its first voice</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg/55">
                  Send one sentence on what Ghana's representatives should put forward —
                  it goes up here once approved.
                </p>
              </Card>
            )}
            {suggestionsList.map((s, i) => {
              const upvoted = currentUser ? s.upvotes.includes(currentUser.id) : false;
              const isTop = i === 0 && s.upvotes.length > 0;
              return (
                <Card key={s.id} hover className="group relative overflow-hidden p-5">
                  {s.featured && (
                    <span className="flag-stripes absolute inset-x-0 top-0 h-[3px]" aria-hidden />
                  )}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <button
                      onClick={() => {
                        if (!currentUser) return toast("Join the circle to upvote", "error");
                        upvoteSuggestion.mutate({ memberId: currentUser.id, suggestionId: s.id });
                      }}
                      className={cn(
                        "flex flex-col items-center rounded-2xl border px-3 py-2 transition-all duration-200 cursor-pointer active:scale-90",
                        upvoted
                          ? "border-flag-green bg-flag-green/10 text-flag-green shadow-sm"
                          : "border-fg/15 text-fg/50 hover:border-flag-green hover:text-flag-green hover:shadow-sm",
                      )}
                      title={upvoted ? "Remove your upvote" : "Upvote — this voice rises"}
                    >
                      <ThumbsUp size={16} className={cn(upvoted && "fill-current")} />
                      <span className="text-sm font-bold">{s.upvotes.length}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-relaxed text-fg/85">“{s.text}”</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-fg/45">
                        {isTop && (
                          <Chip tone="gold" className="px-2 py-0.5 text-[10px]">
                            <Star size={10} className="fill-current" /> Top voice
                          </Chip>
                        )}
                        {s.featured && !isTop && (
                          <Chip tone="gold" className="px-2 py-0.5 text-[10px]">
                            <Star size={10} /> Featured
                          </Chip>
                        )}
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-cream"
                          style={{ background: avatarColor(s.authorName) }}
                        >
                          {initials(s.authorName)}
                        </span>
                        <span className="font-semibold text-fg/60">{s.authorName}</span>
                        <span>· {timeAgo(s.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setShareTarget({ text: s.text, authorName: s.authorName, url: "/civic#voice" })
                      }
                      className="rounded-full p-2 text-fg/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-flag-green/10 hover:text-flag-green pointer-coarse:opacity-100 cursor-pointer"
                      title="Share this voice"
                      aria-label="Share this voice"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </Card>
              );
            })}
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

      <ShareModal open={!!shareTarget} onClose={() => setShareTarget(null)} target={shareTarget} />
    </div>
  );
}
