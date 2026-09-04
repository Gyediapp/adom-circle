import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Send, Loader2, MessageSquare, ArrowLeft, CheckCheck } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Modal, Avatar, Button } from "./ui";
import { DM_MIN_POINTS } from "@/shared/constants";
import { timeAgo, cn } from "@/client/lib/format";

export function DmModal({
  open,
  onClose,
  initialTarget,
}: {
  open: boolean;
  onClose: () => void;
  initialTarget?: { id: string; name: string } | null;
}) {
  const { user, toast, requireUser } = useStore();
  const me = requireUser();
  const [convoId, setConvoId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const unlocked = !!me && me.points >= DM_MIN_POINTS;

  const { data: convos } = useQuery(
    queryClient.dms.list.queryOptions({
      input: { memberId: me?.id ?? "" },
      enabled: open && !!me && unlocked,
      refetchInterval: open ? 5_000 : false,
    }),
  );
  const { data: messages } = useQuery(
    queryClient.dms.messages.queryOptions({
      input: { memberId: me?.id ?? "", convoId: convoId ?? "" },
      enabled: open && !!me && unlocked && !!convoId,
      refetchInterval: open && convoId ? 5_000 : false,
    }),
  );

  const start = useMutation(
    queryClient.dms.start.mutationOptions({
      onSuccess: (c) => {
        setConvoId(c.id);
        setTarget(null);
      },
      onError: (e: any) => toast(e?.message ?? "Could not start chat", "error"),
    }),
  );
  const send = useMutation(
    queryClient.dms.send.mutationOptions({
      onSuccess: () => setText(""),
      onError: (e: any) => toast(e?.message ?? "Could not send", "error"),
    }),
  );

  // When opened with a target (e.g. from a chat message), start the conversation
  useEffect(() => {
    if (open && initialTarget && me && unlocked && !convoId) {
      start.mutate({ fromId: me.id, toId: initialTarget.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTarget]);

  useEffect(() => {
    if (!open) {
      setConvoId(null);
      setTarget(null);
      setText("");
    }
  }, [open]);

  // Scroll to the newest message reliably once the pane renders
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
    return () => clearTimeout(id);
  }, [messages?.length, convoId]);

  const activeConvo = convos?.find((c) => c.id === convoId) ?? null;
  const convoList = useMemo(() => convos ?? [], [convos]);
  const pointsLeft = Math.max(0, DM_MIN_POINTS - (me?.points ?? 0));

  if (!me) return null;

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex h-[72vh] flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-fg/10 px-5 py-4">
          {convoId && (
            <button
              onClick={() => setConvoId(null)}
              className="rounded-full p-1.5 text-fg/50 hover:bg-ink/5 hover:text-fg transition-colors cursor-pointer lg:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <MessageSquare size={18} className="text-flag-red" />
          <p className="font-display text-lg font-bold">Private messages</p>
          {convoId && activeConvo?.other && (
            <span className="hidden sm:inline-flex items-center gap-2 ml-2 rounded-full bg-soft px-3 py-1 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-flag-green" />
              {activeConvo.other.name}
            </span>
          )}
        </div>

        {/* Locked state */}
        {!unlocked && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="rounded-2xl bg-ink p-4 text-flag-gold">
              <Lock size={26} />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Private messaging is locked</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg/60">
                Private chat unlocks at <strong className="text-flag-red">{DM_MIN_POINTS} points</strong>.
                Chat in rooms, post discussions and RSVP to events to earn points — you're{" "}
                <strong>{pointsLeft} points</strong> away.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-fg/50">
                <span>Points</span>
                <span>{me?.points ?? 0} / {DM_MIN_POINTS}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ink/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-flag-red via-flag-gold to-flag-green"
                  style={{ width: `${Math.min(100, ((me?.points ?? 0) / DM_MIN_POINTS) * 100)}%` }}
                />
              </div>
            </div>
            <Button variant="outline" onClick={onClose}>Back to community</Button>
          </div>
        )}

        {/* Main layout */}
        {unlocked && (
          <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr]">
            {/* Conversation list */}
            <div className={cn("min-h-0 overflow-y-auto border-r border-fg/10", convoId && "hidden lg:block")}>
              {convoList.length === 0 && !target && (
                <p className="px-5 py-8 text-center text-sm text-fg/45">
                  No conversations yet.
                  <br />
                  Tap the <strong>Message</strong> icon on any community message to start one.
                </p>
              )}
              {convoList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConvoId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer hover:bg-soft/60",
                    convoId === c.id && "bg-soft",
                  )}
                >
                  <Avatar name={c.other?.name ?? "?"} size={40} src={c.other?.avatarImage} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">{c.other?.name}</p>
                      <span className="shrink-0 text-[10px] font-semibold text-fg/35">{timeAgo(c.lastAt)}</span>
                    </div>
                    <p className="truncate text-[12px] text-fg/55">{c.lastText || "Start the conversation…"}</p>
                  </div>
                  {(c.unreadForMe ?? 0) > 0 && (
                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-flag-red px-1.5 text-[10px] font-bold text-cream">
                      {c.unreadForMe > 9 ? "9+" : c.unreadForMe}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Chat pane */}
            <div className={cn("flex min-h-0 flex-col", !convoId && "hidden lg:flex")}>
              {!convoId && !target ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-fg/45">
                  Select a conversation, or tap the Message icon on any community message.
                </div>
              ) : (
                <>
                  <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-soft/40 px-5 py-4">
                    {(!messages || messages.length === 0) && (
                      <p className="pt-8 text-center text-sm text-fg/40">
                        Say hello to {activeConvo?.other?.name ?? "them"} 🇬🇭
                      </p>
                    )}
                    {messages?.map((m) => {
                      const mine = m.fromId === me.id;
                      return (
                        <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                          <Avatar
                            name={mine ? me.name : activeConvo?.other?.name ?? "?"}
                            size={32}
                            src={mine ? me.avatarImage : activeConvo?.other?.avatarImage}
                          />
                          <div className={cn("max-w-[78%]", mine && "text-right")}>
                            <div className={cn("mb-1 flex items-center gap-2", mine && "justify-end")}>
                              <span className="text-[12px] font-bold">
                                {mine ? me.name : activeConvo?.other?.name}
                              </span>
                              <span className="text-[10px] text-fg/40">{timeAgo(m.createdAt)}</span>
                            </div>
                            <div
                              className={cn(
                                "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                                mine ? "bg-ink text-cream rounded-br-sm" : "bg-card border border-fg/5 rounded-bl-sm",
                              )}
                            >
                              {m.text}
                            </div>
                            {mine && (
                              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-fg/35">
                                <CheckCheck size={12} />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-fg/8 bg-card p-3.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder={`Message ${activeConvo?.other?.name ?? "…"}`}
                        className="flex-1 rounded-full border border-fg/12 bg-soft/50 px-4 py-2.5 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
                      />
                      <Button variant="dark" className="rounded-full p-3" onClick={sendMessage} disabled={send.isPending || !text.trim()}>
                        {send.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {target && unlocked && (
          <div className="border-t border-fg/10 px-5 py-2.5 text-[13px] text-fg/55">
            Starting a chat with <strong className="text-fg">{target.name}</strong>…
          </div>
        )}
      </div>
    </Modal>
  );

  function sendMessage() {
    if (!me || !convoId || !text.trim()) return;
    send.mutate({ fromId: me.id, convoId, text: text.trim() });
  }
}
