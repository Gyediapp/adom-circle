import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Heart,
  MessageSquareReply,
  CalendarDays,
  Trophy,
  Megaphone,
  CheckCheck,
  Trash2,
  Sparkles,
} from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { timeAgo } from "@/client/lib/format";
import { cn } from "@/client/lib/format";

const TYPE_ICON = {
  reply: <MessageSquareReply size={14} />,
  like: <Heart size={14} />,
  event: <CalendarDays size={14} />,
  rank: <Trophy size={14} />,
  broadcast: <Megaphone size={14} />,
  system: <Sparkles size={14} />,
};

const TYPE_COLOR: Record<string, string> = {
  reply: "text-flag-green",
  like: "text-flag-red",
  event: "text-flag-gold",
  rank: "text-[#7C3AED]",
  broadcast: "text-flag-red",
  system: "text-fg/60",
};

export function NotificationBell() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const memberId = user?.id ?? "";

  const { data: unread } = useQuery(
    queryClient.notifications.unreadCount.queryOptions({
      input: { memberId },
      enabled: !!user,
      refetchInterval: 30_000,
    }),
  );
  const { data: items } = useQuery(
    queryClient.notifications.list.queryOptions({
      input: { memberId },
      enabled: !!user && open,
      refetchInterval: 30_000,
    }),
  );

  const markAll = useMutation(
    queryClient.notifications.markAllRead.mutationOptions(),
  );
  const markOne = useMutation(
    queryClient.notifications.markRead.mutationOptions(),
  );
  const clear = useMutation(
    queryClient.notifications.clear.mutationOptions(),
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const count = unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2.5 transition-colors cursor-pointer hover:bg-black/5"
        aria-label="Notifications"
      >
        <Bell size={19} className="text-fg" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-flag-red px-1 text-[10px] font-bold text-cream animate-pulse-soft">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[70] w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => memberId && markAll.mutate({ memberId })}
                className="rounded-full p-1.5 text-fg/45 hover:text-flag-green hover:bg-flag-green/10 cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck size={15} />
              </button>
              <button
                onClick={() => memberId && clear.mutate({ memberId })}
                className="rounded-full p-1.5 text-fg/45 hover:text-flag-red hover:bg-flag-red/10 cursor-pointer"
                title="Clear all"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {(!items || items.length === 0) && (
              <p className="px-6 py-10 text-center text-sm text-fg/45">
                No notifications yet. Join a discussion or RSVP to an event! 🇬🇭
              </p>
            )}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() =>
                  !n.read &&
                  markOne.mutate({ memberId, notificationId: n.id })
                }
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                  n.read ? "opacity-55 hover:opacity-80" : "bg-flag-gold/8 hover:bg-flag-gold/15",
                )}
              >
                <span className={cn("mt-0.5 shrink-0 rounded-lg bg-soft p-2", TYPE_COLOR[n.type])}>
                  {TYPE_ICON[n.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold leading-snug">{n.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[12px] leading-snug text-fg/55">
                    {n.body}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-fg/35">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-flag-red" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
