import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, User, Star, Newspaper, BookOpen } from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { Button, Card, Chip, Modal } from "./ui";
import { cn, timeAgo } from "@/client/lib/format";
import type { Post } from "@/server/rpc/site";

const CATEGORIES = ["All", "News", "Story", "Civic", "Economy", "Values"] as const;
type Category = (typeof CATEGORIES)[number];

export function Blog() {
  const { data: posts } = useQuery(queryClient.posts.list.queryOptions());
  const [cat, setCat] = useState<Category>("All");
  const [reading, setReading] = useState<Post | null>(null);

  // Featured first, then newest
  const list = useMemo(() => {
    const sorted = [...(posts ?? [])].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return cat === "All" ? sorted : sorted.filter((p) => p.category === cat);
  }, [posts, cat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: posts?.length ?? 0 };
    for (const p of posts ?? []) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [posts]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-36 pb-20 sm:px-6">
      {/* Header */}
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
          <span className="flag-stripes h-[3px] w-10 rounded-full" aria-hidden />
          From the circle
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
          Stories & <span className="text-flag-red">updates</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg leading-relaxed text-fg/60">
          News, stories, civic education and economic insights from the Adom Circle community — at home and in the diaspora.
        </p>
      </div>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer",
              cat === c
                ? "border-ink bg-ink text-cream"
                : "border-fg/15 bg-card text-fg/60 hover:border-flag-red hover:text-flag-red",
            )}
          >
            {c}
            <span className={cn("ml-1.5 text-[11px]", cat === c ? "text-cream/60" : "text-fg/35")}>
              {counts[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {list.length === 0 ? (
        <Card className="p-16 text-center">
          <Newspaper size={26} className="mx-auto mb-3 text-fg/30" />
          <p className="text-sm font-bold">No posts here yet</p>
          <p className="mt-1 text-[13px] text-fg/50">
            {cat === "All" ? "The first story will appear here soon." : `No ${cat} posts yet — check back soon.`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((post) => (
            <Card key={post.id} hover className="flex flex-col overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                <Chip tone={post.featured ? "gold" : "red"} className="absolute left-3 top-3">
                  {post.featured && <Star size={11} className="fill-current" />} {post.category}
                </Chip>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                  <span className="flex items-center gap-1"><User size={11} /> {post.author}</span>
                  <span className="flex items-center gap-1"><CalendarDays size={11} /> {timeAgo(post.createdAt)}</span>
                </div>
                <h3 className="mt-2.5 font-display text-lg font-bold leading-snug">{post.title}</h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-fg/60">{post.body}</p>
                <div className="mt-auto pt-5">
                  <Button
                    variant="outline"
                    className="w-full px-4 py-2 text-xs"
                    onClick={() => setReading(post)}
                  >
                    <BookOpen size={13} /> Read story
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reading modal */}
      <Modal open={!!reading} onClose={() => setReading(null)} wide>
        {reading && (
          <article>
            <div className="relative h-56 sm:h-72 w-full overflow-hidden">
              <img src={reading.image} alt={reading.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <Chip tone={reading.featured ? "gold" : "red"}>
                  {reading.featured && <Star size={11} className="fill-current" />} {reading.category}
                </Chip>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-cream leading-tight">
                  {reading.title}
                </h2>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-fg/8 pb-4 text-[12px] font-semibold text-fg/50">
                <span className="flex items-center gap-1.5"><User size={12} /> {reading.author}</span>
                <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {new Date(reading.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg/85">
                {reading.body}
              </div>
              <div className="mt-8 flex items-center gap-2 rounded-2xl bg-soft p-4 text-[13px] text-fg/60">
                <Star size={14} className="shrink-0 text-flag-gold" aria-hidden />
                Published with love by the Adom Circle team. Join the conversation in the Community.
              </div>
            </div>
          </article>
        )}
      </Modal>
    </div>
  );
}
