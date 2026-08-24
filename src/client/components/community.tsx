import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send,
  ThumbsUp,
  MessageSquare,
  Users,
  Flag,
  Loader2,
  Pin,
  Reply,
  MessagesSquare,
  Trash2,
} from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Avatar, Modal } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { timeAgo } from "@/client/lib/format";
import { regionName } from "@/server/data/regions";

export function Community() {
  const { user, toast, requireUser } = useStore();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "forum">("chat");
  const [text, setText] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState("");

  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { data: threads } = useQuery(queryClient.community.liveThreads.list.experimental_liveOptions());

  const activeRoom = rooms?.find((r) => r.id === roomId) ?? rooms?.[0] ?? null;

  const { data: messages } = useQuery(
    queryClient.community.liveMessages.byRoom.experimental_liveOptions({
      input: { roomId: activeRoom?.id ?? "" },
      enabled: !!activeRoom,
    }),
  );

  const sendMessage = useMutation(
    queryClient.community.sendMessage.mutationOptions({
      onSuccess: () => toast("Message sent"),
      onError: (e: any) => toast(e?.message ?? "Failed to send", "error"),
    }),
  );

  const createThread = useMutation(
    queryClient.community.createThread.mutationOptions({
      onSuccess: () => toast("Discussion started! 🗣️"),
      onError: (e: any) => toast(e?.message ?? "Failed to post", "error"),
    }),
  );

  const replyToThread = useMutation(
    queryClient.community.replyToThread.mutationOptions({
      onSuccess: () => toast("Reply posted"),
      onError: (e: any) => toast(e?.message ?? "Failed to reply", "error"),
    }),
  );

  const likeThread = useMutation(queryClient.community.likeThread.mutationOptions());
  const deleteMessage = useMutation(
    queryClient.community.deleteMessage.mutationOptions({
      onSuccess: () => toast("Message removed"),
      onError: (e: any) => toast(e?.message ?? "Not allowed", "error"),
    }),
  );
  const deleteThread = useMutation(
    queryClient.community.deleteThread.mutationOptions({
      onSuccess: () => toast("Discussion removed"),
      onError: (e: any) => toast(e?.message ?? "Not allowed", "error"),
    }),
  );
  const createReport = useMutation(
    queryClient.community.createReport.mutationOptions({
      onSuccess: () => {
        toast("Report submitted — thank you for keeping the circle safe.");
        setReportTarget(null);
        setReportReason("");
      },
    }),
  );

  const me = requireUser();

  const submitMessage = () => {
    if (!me) return toast("Sign in to join the conversation", "error");
    if (!activeRoom) return;
    if (!text.trim()) return;
    sendMessage.mutate({ memberId: me.id, roomId: activeRoom.id, text: text.trim() });
    setText("");
  };

  const roomThreads = useMemo(
    () => threads?.filter((t) => t.roomId === activeRoom?.id) ?? [],
    [threads, activeRoom],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-36 pb-20 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
            <MessagesSquare size={14} /> Community
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">
            Where <span className="text-flag-green">Ghana talks.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg/60">
            Respectful discussion, real connection. The Constitution above all — no hate speech, no incitement, everyone welcome.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "chat" ? "dark" : "outline"} onClick={() => setView("chat")}>
            <MessageSquare size={16} /> Chatrooms
          </Button>
          <Button variant={view === "forum" ? "dark" : "outline"} onClick={() => setView("forum")}>
            <MessagesSquare size={16} /> Forum
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr]">
        {/* Rooms sidebar */}
        <div className="space-y-2">
          <p className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-fg/40">Discussion rooms</p>
          {rooms?.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoomId(r.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all cursor-pointer ${
                activeRoom?.id === r.id
                  ? "border-fg bg-ink text-cream shadow-lg"
                  : "border-fg/10 bg-card hover:border-flag-green/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {r.icon} {r.name}
                </span>
                {r.pinned && <Pin size={13} className={activeRoom?.id === r.id ? "text-flag-gold" : "text-flag-red"} />}
              </div>
              <p className={`mt-0.5 line-clamp-1 text-[12px] ${activeRoom?.id === r.id ? "text-cream/60" : "text-fg/45"}`}>
                {r.description}
              </p>
              <p className={`mt-1 text-[11px] font-semibold ${activeRoom?.id === r.id ? "text-gold-soft" : "text-fg/35"}`}>
                {r.messageCount} messages
              </p>
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div>
          {view === "chat" && activeRoom && (
            <Card className="flex h-[68vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-fg/8 px-5 py-3.5">
                <div>
                  <p className="font-bold">{activeRoom.icon} {activeRoom.name}</p>
                  <p className="text-[12px] text-fg/50">{activeRoom.description}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-flag-green/10 px-3 py-1 text-[11px] font-bold text-flag-green">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-flag-green" /> live
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-soft/40 px-5 py-4">
                {messages?.map((m) => {
                  const mine = m.authorId === me?.id;
                  const canModerate = me
                    ? me.role === "admin" ||
                      (me.role === "moderator" && me.managedRooms.includes(activeRoom.id))
                    : false;
                  return (
                    <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                      <Avatar name={m.authorName} size={34} />
                      <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                        <div className={`mb-1 flex items-center gap-2 ${mine ? "justify-end" : ""} flex-wrap`}>
                          <span className="text-[12px] font-bold">{m.authorName}</span>
                          <RankChip points={(m as any).authorPoints ?? 0} role={(m as any).authorRole} />
                          <span className="text-[10px] text-fg/40">{regionName(m.authorRegion)} · {timeAgo(m.createdAt)}</span>
                          {canModerate && !mine && (
                            <button
                              onClick={() => me && deleteMessage.mutate({ memberId: me.id, messageId: m.id })}
                              className="rounded-full p-1 text-fg/25 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                              title="Delete message (moderator)"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div
                          className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                            mine ? "bg-ink text-cream rounded-br-sm" : "bg-card border border-fg/5 rounded-bl-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!messages || messages.length === 0) && (
                  <div className="flex h-full items-center justify-center text-sm text-fg/40">
                    Start the conversation in {activeRoom.name} 💬
                  </div>
                )}
              </div>

              <div className="border-t border-fg/8 bg-card p-3.5">
                <div className="flex items-center gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitMessage()}
                    placeholder={me ? `Message #${activeRoom.name.toLowerCase()}…` : "Sign in to join the conversation…"}
                    className="flex-1 rounded-full border border-fg/12 bg-soft/50 px-4 py-2.5 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
                  />
                  <Button variant="dark" className="rounded-full p-3" onClick={submitMessage} disabled={sendMessage.isPending}>
                    {sendMessage.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {view === "forum" && activeRoom && (
            <div className="space-y-5">
              <ForumComposer
                roomId={activeRoom.id}
                onCreate={(title, body) => {
                  if (!me) return toast("Sign in to start a discussion", "error");
                  createThread.mutate({ memberId: me.id, roomId: activeRoom.id, title, body });
                }}
              />
              {roomThreads.length === 0 && (
                <Card className="p-10 text-center text-sm text-fg/45">
                  No discussions yet in {activeRoom.name}. Start one above! 🎉
                </Card>
              )}
              {roomThreads.map((t) => (
                <ForumThread
                  key={t.id}
                  threadId={t.id}
                  title={t.title}
                  body={t.body}
                  authorName={t.authorName}
                  authorPoints={(t as any).authorPoints ?? 0}
                  authorRole={(t as any).authorRole ?? "member"}
                  createdAt={t.createdAt}
                  likes={t.likes}
                  replyCount={t.replyCount}
                  liked={me ? t.likedBy.includes(me.id) : false}
                  canModerate={
                    !!me &&
                    (me.role === "admin" ||
                      (me.role === "moderator" && me.managedRooms.includes(activeRoom.id)))
                  }
                  onLike={() => {
                    if (!me) return toast("Sign in to like", "error");
                    likeThread.mutate({ memberId: me.id, threadId: t.id });
                  }}
                  onReply={(text) => {
                    if (!me) return toast("Sign in to reply", "error");
                    replyToThread.mutate({ memberId: me.id, threadId: t.id, text });
                  }}
                  onDelete={() => {
                    if (!me) return;
                    deleteThread.mutate({ memberId: me.id, threadId: t.id });
                  }}
                  onReport={() => setReportTarget({ type: "thread", label: t.title })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report modal */}
      <Modal open={!!reportTarget} onClose={() => setReportTarget(null)}>
        <div className="p-6 sm:p-8">
          <p className="mb-1 flex items-center gap-2 font-display text-xl font-bold">
            <Flag size={18} className="text-flag-red" /> Report content
          </p>
          <p className="mb-5 text-sm text-fg/55">
            Reporting “{reportTarget?.label}”. We review all reports within 48 hours.
          </p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Why are you reporting this? (hate speech, spam, misinformation…)"
            className="h-28 w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
          />
          <Button
            variant="danger"
            className="mt-4 w-full py-3"
            disabled={reportReason.trim().length < 3}
            onClick={() =>
              createReport.mutate({
                reporter: me?.name ?? "Guest",
                targetType: reportTarget?.type as any,
                targetLabel: reportTarget?.label ?? "",
                reason: reportReason,
              })
            }
          >
            Submit report
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ForumComposer({
  roomId,
  onCreate,
}: {
  roomId: string;
  onCreate: (title: string, body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Card className="p-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-fg/20 bg-soft/40 px-4 py-3.5 text-left text-sm text-fg/45 hover:border-flag-green hover:text-flag-green transition-colors cursor-pointer"
        >
          Start a new discussion in this room…
        </button>
      ) : (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discussion title"
            className="w-full rounded-xl border border-fg/15 bg-card px-4 py-2.5 text-sm font-semibold outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts — respectfully, constructively, for Ghana 🇬🇭"
            className="h-28 w-full rounded-xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
          />
          <div className="flex gap-2">
            <Button
              variant="dark"
              onClick={() => {
                if (title.trim().length < 3 || body.trim().length < 3) return;
                onCreate(title.trim(), body.trim());
                setOpen(false);
                setTitle("");
                setBody("");
              }}
            >
              Post discussion
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ForumThread({
  threadId,
  title,
  body,
  authorName,
  authorPoints,
  authorRole,
  createdAt,
  likes,
  replyCount,
  liked,
  canModerate,
  onLike,
  onReply,
  onDelete,
  onReport,
}: {
  threadId: string;
  title: string;
  body: string;
  authorName: string;
  authorPoints: number;
  authorRole: string;
  createdAt: string;
  likes: number;
  replyCount: number;
  liked: boolean;
  canModerate: boolean;
  onLike: () => void;
  onReply: (text: string) => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const [openReplies, setOpenReplies] = useState(false);
  const [replyText, setReplyText] = useState("");

  const { data } = useQuery(
    queryClient.community.getThread.queryOptions({
      input: { threadId },
      enabled: openReplies,
    }),
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <Avatar name={authorName} size={38} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold">{authorName}</p>
              <RankChip points={authorPoints} role={authorRole} />
            </div>
            <p className="text-[11px] text-fg/40">{timeAgo(createdAt)}</p>
          </div>
          {canModerate && (
            <button
              onClick={onDelete}
              className="ml-auto rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
              title="Delete discussion (moderator)"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={onReport}
            className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
            title="Report"
          >
            <Flag size={15} />
          </button>
        </div>
        <h3 className="font-display text-xl font-bold leading-snug">{title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg/70">{body}</p>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={onLike}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
              liked ? "bg-flag-red text-cream" : "bg-soft text-fg/60 hover:text-flag-red"
            }`}
          >
            <ThumbsUp size={14} /> {likes}
          </button>
          <button
            onClick={() => setOpenReplies(!openReplies)}
            className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3.5 py-1.5 text-sm font-semibold text-fg/60 hover:text-flag-green transition-colors cursor-pointer"
          >
            <Reply size={14} /> {replyCount} replies
          </button>
        </div>
      </div>

      {openReplies && (
        <div className="border-t border-fg/8 bg-soft/30 px-6 py-4">
          <div className="space-y-3">
            {data?.replies.map((r) => (
              <div key={r.id} className="flex gap-3">
                <Avatar name={r.authorName} size={30} />
                <div className="rounded-2xl bg-card px-4 py-2.5 text-sm border border-fg/5">
                  <p className="text-[12px] font-bold">{r.authorName} <span className="ml-1 font-normal text-fg/35">{timeAgo(r.createdAt)}</span></p>
                  <p className="mt-0.5 leading-relaxed text-fg/75">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && replyText.trim()) {
                  onReply(replyText.trim());
                  setReplyText("");
                }
              }}
              placeholder="Write a reply…"
              className="flex-1 rounded-full border border-fg/12 bg-card px-4 py-2 text-sm outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/15"
            />
            <Button
              variant="dark"
              className="rounded-full px-4"
              onClick={() => {
                if (replyText.trim()) {
                  onReply(replyText.trim());
                  setReplyText("");
                }
              }}
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
