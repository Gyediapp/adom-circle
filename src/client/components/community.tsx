import { useEffect, useMemo, useRef, useState } from "react";
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
  Bookmark,
  Share2,
  UserPlus,
  UserCheck,
  MessageCircle,
  CornerDownRight,
  X,
  Pencil,
  Mic,
  Square,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Button, Card, Avatar, Modal } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { timeAgo, cn } from "@/client/lib/format";
import { regionName } from "@/server/data/regions";
import type { Message, ReactionType } from "@/server/rpc/community";
import type { PublicMember } from "@/server/rpc/members";
import { DmModal } from "./dm-modal";
import { ShareModal, type ShareTarget } from "./share-modal";
import { MemberModal } from "./member-modal";
import { BarChart3, Kanban, SmilePlus } from "lucide-react";

type ChatMsg = Message & { authorPoints: number; authorRole: string };

const REACTIONS: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "smile", emoji: "😊", label: "Smile" },
  { type: "angry", emoji: "😠", label: "Angry" },
  { type: "undecided", emoji: "🤔", label: "Undecided" },
];

// Timezone-aware display: local time (viewer's clock) + Ghana time, e.g. "14:03 · Accra 13:03"
function localTime(iso: string): string {
  try {
    const d = new Date(iso);
    const local = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const ghana = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Accra",
    });
    return ghana === local ? local : `${local} · Accra ${ghana}`;
  } catch {
    return "";
  }
}

export function Community() {
  const { user, toast, requireUser } = useStore();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "forum">("chat");
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [dmOpen, setDmOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState<{ id: string; name: string } | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(requireUser()?.following ?? []));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [profileMember, setProfileMember] = useState<string | null>(null);
  // Optimistic send queue — pending messages appear instantly, retried on failure
  const [pendingMsgs, setPendingMsgs] = useState<
    Array<ChatMsg & { failed?: boolean }>
  >([]);
  const pendingRef = useRef(pendingMsgs);
  pendingRef.current = pendingMsgs;
  // Cache of author metadata (verified badge) by member id
  const authorsById = useRef(new Map<string, { verified?: boolean; merchantName?: string }>());
  // Anonymous posting (Health & Welfare)
  const [anonymous, setAnonymous] = useState(false);
  // Audio-only mode toggle (General)
  const [audioOnly, setAudioOnly] = useState(false);
  // @mentions
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<Array<{ id: string; name: string }>>([]);
  const mentionAtRef = useRef<number | null>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  // voice messages
  const supportsAudio =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioData, setAudioData] = useState<string | null>(null);
  const chatScroll = useRef<HTMLDivElement>(null);

  // Debounced member search for the @mention dropdown
  useEffect(() => {
    if (!mentionQuery) {
      setMentionResults([]);
      return;
    }
    const t = setTimeout(() => {
      rpcClient.members
        .search({ q: mentionQuery })
        .then(setMentionResults)
        .catch(() => setMentionResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [mentionQuery]);

  const { data: rooms } = useQuery(queryClient.community.getRooms.queryOptions());
  const { data: threads } = useQuery(queryClient.community.liveThreads.list.experimental_liveOptions());

  const activeRoom = rooms?.find((r) => r.id === roomId) ?? rooms?.[0] ?? null;

  const { data: messages } = useQuery(
    queryClient.community.liveMessages.byRoom.experimental_liveOptions({
      input: { roomId: activeRoom?.id ?? "" },
      enabled: !!activeRoom,
    }),
  );

  const { data: polls } = useQuery(
    queryClient.polls.list.queryOptions({
      input: { roomId: activeRoom?.id ?? "" },
      enabled: !!activeRoom && (activeRoom.features ?? []).includes("polls"),
    }),
  );

  // Cache author metadata (verified badge) for message authors
  useEffect(() => {
    const ids = new Set<string>();
    for (const m of messages ?? []) if (m.authorId !== "anonymous") ids.add(m.authorId);
    for (const id of ids) {
      if (authorsById.current.has(id)) continue;
      rpcClient.members
        .byId(id)
        .then((m) => {
          if (m) authorsById.current.set(id, { verified: m.verified, merchantName: m.merchantName });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Optimistic send: append a pending copy instantly, persist in the background,
  // and reconcile once the server confirms (drop the pending copy).
  const sendMessage = useMutation(
    queryClient.community.sendMessage.mutationOptions({
      onSuccess: (saved, vars) => {
        setText("");
        setReplyingTo(null);
        setMentionIds([]);
        setAudioData(null);
        setAnonymous(false);
        setPendingMsgs((q) => q.filter((p) => p.id !== (vars.confirmPending ?? "__none__")));
      },
      onError: (e: any, vars) => {
        setPendingMsgs((q) =>
          q.map((p) =>
            p.id === (vars.confirmPending ?? "__none__") ? { ...p, failed: true } : p,
          ),
        );
        toast(e?.message ?? "Failed to send — tap the message to retry", "error");
      },
    }),
  );

  const submitMessage = () => {
    if (!me) return toast("Sign in to join the conversation", "error");
    if (!activeRoom) return;
    if (!text.trim() && !audioData) return;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const pending: ChatMsg & { failed?: boolean } = {
      id: pendingId,
      roomId: activeRoom.id,
      authorId: anonymous ? "anonymous" : me.id,
      authorName: anonymous ? "Anonymous" : me.name,
      authorRegion: anonymous ? "" : me.region,
      text: text.trim(),
      createdAt: nowIso,
      sentAt: nowIso,
      replyToId: replyingTo?.id ?? null,
      reactions: {},
      savedBy: [],
      editedAt: null,
      deleted: false,
      mentions: [],
      audio: audioData,
      anonymous,
      pending: true,
      failed: false,
      authorPoints: me.points,
      authorRole: me.role,
    };
    setPendingMsgs((q) => [...q, pending]);
    sendMessage.mutate({
      memberId: me.id,
      roomId: activeRoom.id,
      text: text.trim(),
      replyToId: replyingTo?.id ?? null,
      mentionIds,
      audio: audioData,
      anonymous,
      confirmPending: pendingId,
    });
  };

  // Tap-to-retry — resend a failed pending message
  const retryPending = (pendingId: string) => {
    const p = pendingRef.current.find((m) => m.id === pendingId);
    if (!p || !me || !activeRoom) return;
    setPendingMsgs((q) =>
      q.map((m) => (m.id === pendingId ? { ...m, failed: false, pending: true } : m)),
    );
    sendMessage.mutate({
      memberId: me.id,
      roomId: activeRoom.id,
      text: p.text,
      replyToId: p.replyToId,
      mentionIds: p.mentions?.map((m) => m.id) ?? [],
      audio: p.audio,
      anonymous: p.anonymous,
      confirmPending: pendingId,
    });
  };

  const react = useMutation(
    queryClient.community.addReaction.mutationOptions({
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );
  const editMsg = useMutation(
    queryClient.community.editMessage.mutationOptions({
      onSuccess: () => {
        setEditingId(null);
        setEditText("");
        toast("Message updated");
      },
      onError: (e: any) => toast(e?.message ?? "Failed to edit", "error"),
    }),
  );
  const deleteMsg = useMutation(
    queryClient.community.deleteMessage.mutationOptions({
      onSuccess: () => {
        setConfirmingDelete(null);
        toast("Message deleted");
      },
      onError: (e: any) => toast(e?.message ?? "Not allowed", "error"),
    }),
  );
  const saveMsg = useMutation(
    queryClient.community.toggleSaveMessage.mutationOptions({
      onSuccess: (_d, vars) =>
        toast(
          _d?.savedBy?.includes(vars.memberId) ? "Saved to your bookmarks 🔖" : "Removed from bookmarks",
        ),
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );
  const follow = useMutation(
    queryClient.members.follow.mutationOptions({
      onSuccess: (updated) => {
        const targetId = updated.following.at(-1) ?? "";
        const following = updated.following.includes(follow.variables?.targetId ?? targetId);
        setFollowed((prev) => {
          const next = new Set(prev);
          const id = follow.variables?.targetId ?? targetId;
          if (following) next.add(id);
          else next.delete(id);
          return next;
        });
        toast(following ? "You're now following them" : "Unfollowed");
      },
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
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
  const editThread = useMutation(
    queryClient.community.editThread.mutationOptions({
      onSuccess: () => toast("Discussion updated"),
      onError: (e: any) => toast(e?.message ?? "Failed to edit", "error"),
    }),
  );
  const editReply = useMutation(
    queryClient.community.editReply.mutationOptions({
      onSuccess: () => toast("Reply updated"),
      onError: (e: any) => toast(e?.message ?? "Failed to edit", "error"),
    }),
  );
  const deleteReply = useMutation(
    queryClient.community.deleteReply.mutationOptions({
      onSuccess: () => toast("Reply deleted"),
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
  const votePoll = useMutation(
    queryClient.polls.vote.mutationOptions({
      onSuccess: () => toast("Vote recorded"),
      onError: (e: any) => toast(e?.message ?? "Failed to vote", "error"),
    }),
  );
  const createPoll = useMutation(
    queryClient.polls.create.mutationOptions({
      onSuccess: () => {
        toast("Poll created");
        setPollOpen(false);
        setPollQuestion("");
        setPollOptions(["", ""]);
      },
      onError: (e: any) => toast(e?.message ?? "Failed to create poll", "error"),
    }),
  );
  const closePoll = useMutation(
    queryClient.polls.close.mutationOptions({
      onSuccess: () => toast("Poll closed"),
      onError: (e: any) => toast(e?.message ?? "Failed to close poll", "error"),
    }),
  );
  const createTask = useMutation(
    queryClient.projects.createTask.mutationOptions({
      onSuccess: () => {
        setNewTaskTitle("");
        toast("Task added");
      },
      onError: (e: any) => toast(e?.message ?? "Failed to add task", "error"),
    }),
  );
  const moveTask = useMutation(
    queryClient.projects.moveTask.mutationOptions({
      onError: (e: any) => toast(e?.message ?? "Failed to move task", "error"),
    }),
  );
  const deleteTask = useMutation(
    queryClient.projects.deleteTask.mutationOptions({
      onSuccess: () => toast("Task removed"),
      onError: (e: any) => toast(e?.message ?? "Failed", "error"),
    }),
  );
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [myVote, setMyVote] = useState<Record<string, number>>({});
  const [pollVotes, setPollVotes] = useState<Record<string, number[]>>({});
  // Kanban (Projects & Volunteering room)
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const { data: tasks } = useQuery(
    queryClient.projects.liveTasks.list.experimental_liveOptions({
      input: { projectId: activeRoom?.id ?? "" },
      enabled: !!activeRoom && (activeRoom.features ?? []).includes("kanban") && kanbanOpen,
    }),
  );

  const me = requireUser();

  // @mention autocomplete
  const handleComposerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setText(v);
    const caret = e.target.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1]))) {
      const q = before.slice(at + 1);
      if (q.length <= 30 && !/[\s@]/.test(q)) {
        mentionAtRef.current = at;
        setMentionQuery(q);
        return;
      }
    }
    mentionAtRef.current = null;
    setMentionQuery(null);
  };

  const pickMention = (m: { id: string; name: string }) => {
    const at = mentionAtRef.current ?? text.length;
    const before = text.slice(0, at);
    const after = text.slice(at).replace(/^\S*/, "");
    setText(`${before}@${m.name} ${after}`);
    setMentionIds((ids) => (ids.includes(m.id) ? ids : [...ids, m.id]));
    setMentionQuery(null);
    composerRef.current?.focus();
  };

  // Voice message recording
  const startRecording = async () => {
    if (!me) return toast("Sign in to record a voice message", "error");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick a format the device can actually play back: webm on Android/Chrome,
      // mp4 (AAC) on iOS/Safari — otherwise the audio element shows blank.
      const mimeType =
        typeof MediaRecorder !== "undefined"
          ? MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : undefined
          : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = rec;
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mimeType ?? "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioData(reader.result as string);
          stream.getTracks().forEach((t) => t.stop());
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
      // Hard cap at 60 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") stopRecording();
      }, 60_000);
    } catch {
      toast("Microphone access was denied or is unavailable", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  // Message threading: nest replies up to 2 levels by indentation; deeper
  // replies flatten with an inline "in reply to" chip so phones stay readable.
  const msgList = useMemo<ChatMsg[]>(() => {
    const server = (messages ?? []).filter((m) => !m.deleted); // hide deleted entirely
    const pendingIds = new Set(pendingMsgs.map((p) => p.id));
    const serverIds = new Set(server.map((m) => m.id));
    const merged = [...server];
    for (const p of pendingMsgs) {
      if (!serverIds.has(p.id)) merged.push(p as ChatMsg);
    }
    // Oldest at top, newest at bottom (classic chat)
    return merged
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .filter((m) => !pendingIds.has(m.id) || pendingMsgs.some((p) => p.id === m.id));
  }, [messages, pendingMsgs]);

  // Auto-scroll: when a new message arrives and we're near the bottom, glide down
  const [newMsgPill, setNewMsgPill] = useState(false);
  useEffect(() => {
    const el = chatScroll.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setNewMsgPill(false);
    } else {
      setNewMsgPill(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgList.length]);
  const msgById = useMemo(() => new Map(msgList.map((m) => [m.id, m])), [msgList]);
  const replyDepth = (m: Message): number => {
    let depth = 0;
    let cur = m.replyToId;
    while (cur && msgById.has(cur) && depth < 2) {
      depth++;
      cur = msgById.get(cur)?.replyToId ?? null;
    }
    return depth;
  };

  const roomThreads = useMemo(
    () => threads?.filter((t) => t.roomId === activeRoom?.id) ?? [],
    [threads, activeRoom],
  );

  // On phones the room list stacks above the chat/forum panel, so selecting a
  // room or switching views must scroll the panel into view (below the fixed header).
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToPanel = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };
  const selectRoom = (id: string) => {
    setRoomId(id);
    setReplyingTo(null);
    scrollToPanel();
  };
  const selectView = (v: "chat" | "forum") => {
    setView(v);
    scrollToPanel();
  };

  const openDm = (m: ChatMsg) => {
    if (!me) return toast("Sign in to message members", "error");
    if (m.authorId === me.id) return;
    if (me.points < 20) {
      toast("Private messaging unlocks at 20 points — keep contributing!", "error");
      return;
    }
    setDmTarget({ id: m.authorId, name: m.authorName });
    setDmOpen(true);
  };

  const shareMessage = (m: ChatMsg) => {
    if (!m.text && !m.audio) return;
    setShareTarget({
      text: m.text || "🎤 Voice message",
      authorName: m.authorName,
      roomName: activeRoom?.name ?? undefined,
    });
  };

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
            Respectful discussion, real connection. React, reply and message — the Constitution above all, no hate speech, everyone welcome.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "chat" ? "dark" : "outline"} onClick={() => selectView("chat")}>
            <MessageSquare size={16} /> Chatrooms
          </Button>
          <Button variant={view === "forum" ? "dark" : "outline"} onClick={() => selectView("forum")}>
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
              onClick={() => selectRoom(r.id)}
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
        <div ref={panelRef} className="scroll-mt-32">
          {view === "chat" && activeRoom && (activeRoom.features ?? []).includes("polls") && (
            <div className="mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-fg/50">
                  <BarChart3 size={13} className="text-flag-red" /> Community polls
                </p>
                {me && (
                  <button
                    onClick={() => setPollOpen(!pollOpen)}
                    className="rounded-full border border-fg/15 px-3 py-1 text-[11px] font-bold text-fg/60 hover:border-flag-red hover:text-flag-red transition-colors cursor-pointer"
                  >
                    {pollOpen ? "Close" : "+ New poll"}
                  </button>
                )}
              </div>

              {pollOpen && (
                <Card className="p-4">
                  <input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Poll question — e.g. What's the most urgent civic issue?"
                    className="w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red"
                  />
                  {pollOptions.map((o, i) => (
                    <div key={i} className="mt-2 flex items-center gap-2">
                      <input
                        value={o}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-red"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => setPollOptions(pollOptions.filter((_, x) => x !== i))}
                          className="text-fg/30 hover:text-flag-red cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      disabled={pollOptions.length >= 6}
                      className="rounded-full border border-dashed border-fg/20 px-3 py-1 text-[11px] font-bold text-fg/50 hover:border-flag-green hover:text-flag-green disabled:opacity-40 cursor-pointer"
                    >
                      + Add option
                    </button>
                    <Button
                      variant="dark"
                      className="ml-auto rounded-full px-4 py-1.5 text-xs"
                      disabled={pollQuestion.trim().length < 5 || pollOptions.some((o) => !o.trim())}
                      onClick={() =>
                        me &&
                        createPoll.mutate({
                          memberId: me.id,
                          roomId: activeRoom.id,
                          question: pollQuestion,
                          options: pollOptions.map((o) => o.trim()).filter(Boolean),
                        })
                      }
                    >
                      Create poll
                    </Button>
                  </div>
                </Card>
              )}

              {(polls ?? []).slice(0, 3).map((p) => {
                const total = p.total ?? 0;
                const myChoice = myVote[p.id] ?? undefined;
                return (
                  <Card key={p.id} className="p-4">
                    <p className="text-sm font-bold">{p.question}</p>
                    <div className="mt-3 space-y-2">
                      {p.options.map((opt, i) => {
                        const count = p.counts?.[i] ?? 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isMine = myChoice === i;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (!me) return toast("Sign in to vote", "error");
                              if (!p.open) return;
                              votePoll.mutate({ memberId: me.id, pollId: p.id, optionIndex: i });
                              setMyVote((v) => ({ ...v, [p.id]: i }));
                            }}
                            className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                              isMine
                                ? "border-flag-red bg-flag-red/5"
                                : "border-fg/10 bg-card hover:border-flag-red/50"
                            }`}
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-flag-gold/20 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                            <span className="relative flex items-center justify-between">
                              <span className="font-semibold">{opt}</span>
                              <span className="text-[11px] font-bold text-fg/50">{pct}%</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-fg/40">
                      {total} {total === 1 ? "vote" : "votes"}
                      {!p.open && " · closed"}
                      {me && (me.role === "admin" || me.role === "moderator") && p.open && (
                        <button
                          onClick={() =>
                            me &&
                            closePoll.mutate({ memberId: me.id, pollId: p.id })
                          }
                          className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-fg/50 hover:text-flag-red cursor-pointer"
                        >
                          Close poll
                        </button>
                      )}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}

          {view === "chat" && activeRoom && (activeRoom.features ?? []).includes("kanban") && (
            <div className="mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-fg/50">
                  <Kanban size={13} className="text-flag-green" /> Task board
                </p>
                {me && (
                  <button
                    onClick={() => setKanbanOpen(!kanbanOpen)}
                    className="rounded-full border border-fg/15 px-3 py-1 text-[11px] font-bold text-fg/60 hover:border-flag-green hover:text-flag-green transition-colors cursor-pointer"
                  >
                    {kanbanOpen ? "Hide board" : "Show board"}
                  </button>
                )}
              </div>

              {kanbanOpen && (
                <Card className="p-4">
                  <div className="mb-3 flex gap-2">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTaskTitle.trim().length >= 2 && me) {
                          createTask.mutate({
                            memberId: me.id,
                            projectId: activeRoom.id,
                            title: newTaskTitle.trim(),
                          });
                        }
                      }}
                      placeholder="Add a task — e.g. Collect donations for school supplies"
                      className="flex-1 rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none focus:border-flag-green"
                    />
                    <Button
                      variant="dark"
                      className="rounded-xl px-4 py-2 text-xs"
                      disabled={newTaskTitle.trim().length < 2 || !me}
                      onClick={() =>
                        me &&
                        createTask.mutate({
                          memberId: me.id,
                          projectId: activeRoom.id,
                          title: newTaskTitle.trim(),
                        })
                      }
                    >
                      Add
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["todo", "To do", "border-fg/15"],
                        ["doing", "In progress", "border-flag-gold/60"],
                        ["done", "Done", "border-flag-green/60"],
                      ] as Array<[string, string, string]>
                    ).map(([status, label, border]) => {
                      const colTasks = (tasks ?? []).filter((t) => t.status === status);
                      return (
                        <div key={status} className={`rounded-2xl border ${border} bg-soft/40 p-2.5`}>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg/50">
                            {label} <span className="text-fg/30">({colTasks.length})</span>
                          </p>
                          <div className="space-y-2">
                            {colTasks.map((t) => (
                              <div key={t.id} className="group rounded-xl bg-card p-2.5 shadow-sm">
                                <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <div className="flex gap-1">
                                    {status !== "todo" && (
                                      <button
                                        onClick={() =>
                                          me &&
                                          moveTask.mutate({
                                            memberId: me.id,
                                            taskId: t.id,
                                            status: status === "done" ? "doing" : "todo",
                                          })
                                        }
                                        className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-fg/50 hover:text-fg cursor-pointer"
                                        title="Move back"
                                      >
                                        ←
                                      </button>
                                    )}
                                    {status !== "done" && (
                                      <button
                                        onClick={() =>
                                          me &&
                                          moveTask.mutate({
                                            memberId: me.id,
                                            taskId: t.id,
                                            status: status === "todo" ? "doing" : "done",
                                          })
                                        }
                                        className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-fg/50 hover:text-fg cursor-pointer"
                                        title="Move forward"
                                      >
                                        →
                                      </button>
                                    )}
                                  </div>
                                  {me && (me.role === "admin" || me.role === "moderator") && (
                                    <button
                                      onClick={() => me && deleteTask.mutate({ memberId: me.id, taskId: t.id })}
                                      className="rounded-full p-1 text-fg/25 hover:text-flag-red cursor-pointer"
                                      title="Delete task (moderator)"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {colTasks.length === 0 && (
                              <p className="py-3 text-center text-[11px] text-fg/35">No tasks</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-fg/40">
                    Live task board — changes sync across members instantly.
                  </p>
                </Card>
              )}
            </div>
          )}

          {view === "chat" && activeRoom && (
            <Card className="flex h-[72vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-fg/8 px-5 py-3.5">
                <div>
                  <p className="font-bold">{activeRoom.icon} {activeRoom.name}</p>
                  <p className="text-[12px] text-fg/50">{activeRoom.description}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-flag-green/10 px-3 py-1 text-[11px] font-bold text-flag-green">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-flag-green" /> live
                </span>
              </div>

              <div ref={chatScroll} className="flex-1 space-y-4 overflow-y-auto bg-soft/40 px-4 py-4 sm:px-5">
                {msgList.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-fg/40">
                    Start the conversation in {activeRoom.name} 💬
                  </div>
                )}
                {msgList.map((m) => {
                  const authorInfo =
                    m.authorId !== "anonymous"
                      ? (authorsById.current?.get(m.authorId) as
                          | { verified?: boolean; merchantName?: string }
                          | undefined)
                      : undefined;
                  const pendingCopy = pendingMsgs.find((p) => p.id === m.id);
                  return (
                    <ChatMessage
                      key={m.id}
                      m={m}
                      me={me}
                      depth={replyDepth(m)}
                      parentName={m.replyToId ? msgById.get(m.replyToId)?.authorName ?? null : null}
                      followed={followed.has(m.authorId)}
                      canModerate={
                        !!me &&
                        (me.role === "admin" ||
                          (me.role === "moderator" && me.managedRooms.includes(activeRoom.id)))
                      }
                      verified={Boolean(authorInfo?.verified)}
                      onReact={(type) => me && react.mutate({ memberId: me.id, messageId: m.id, type })}
                      onReply={() => {
                        if (!me) return toast("Sign in to reply", "error");
                        setReplyingTo({ id: m.id, name: m.authorName });
                        chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: "smooth" });
                      }}
                      onSave={() => me && saveMsg.mutate({ memberId: me.id, messageId: m.id })}
                      onShare={() => shareMessage(m)}
                      onFollow={() => me && follow.mutate({ memberId: me.id, targetId: m.authorId })}
                      onDm={() => openDm(m)}
                      onEdit={() => {
                        setEditingId(m.id);
                        setEditText(m.text);
                      }}
                      onDelete={() => {
                        setDeleteTarget({ id: m.id, name: m.authorName });
                      }}
                      editing={editingId === m.id}
                      editText={editText}
                      onEditTextChange={setEditText}
                      onEditSave={() => me && editMsg.mutate({ memberId: me.id, messageId: m.id, text: editText })}
                      onEditCancel={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      confirmingDelete={confirmingDelete === m.id}
                      onReport={() => setReportTarget({ type: "message", label: `${m.authorName}: "${m.text.slice(0, 40)}…"` })}
                      onRetry={pendingCopy?.failed ? () => retryPending(m.id) : undefined}
                      onProfile={() => {
                        if (m.anonymous) return;
                        setProfileMember(m.authorId);
                      }}
                    />
                  );
                })}
              </div>

              <div className="border-t border-fg/8 bg-card p-3.5">
                {replyingTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-[12px] font-semibold text-fg/70">
                    <CornerDownRight size={13} className="text-flag-red" />
                    Replying to <strong>{replyingTo.name}</strong>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="ml-auto rounded-full p-1 text-fg/40 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                      aria-label="Cancel reply"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                {audioData ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-soft px-3 py-2">
                    <audio controls src={audioData} className="h-9 w-full min-w-0 flex-1 sm:w-64 sm:flex-none" />
                    <Button
                      variant="dark"
                      className="rounded-full px-4 py-1.5 text-xs"
                      onClick={submitMessage}
                      disabled={sendMessage.isPending}
                    >
                      {sendMessage.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Send voice
                    </Button>
                    <button
                      onClick={() => setAudioData(null)}
                      className="rounded-full p-1.5 text-fg/40 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                      title="Remove voice message"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : recording ? (
                  <div className="mb-2 flex items-center gap-3 rounded-2xl bg-flag-red/10 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-flag-red" />
                    <span className="text-[13px] font-bold text-flag-red">{recSeconds}s</span>
                    <span className="text-[12px] text-fg/55">Recording… speak now (max 60s)</span>
                    <button
                      onClick={stopRecording}
                      className="ml-auto flex items-center gap-1.5 rounded-full bg-flag-red px-3.5 py-1.5 text-xs font-bold text-cream hover:bg-[#a80d1e] transition-colors cursor-pointer"
                    >
                      <Square size={12} className="fill-cream" /> Stop
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={composerRef}
                      value={text}
                      onChange={handleComposerChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !mentionQuery) submitMessage();
                        if (e.key === "Escape") setMentionQuery(null);
                      }}
                      placeholder={me ? `Message #${activeRoom.name.toLowerCase()}… (@ to mention)` : "Sign in to join the conversation…"}
                      className="w-full rounded-full border border-fg/12 bg-soft/50 px-4 py-2.5 pr-10 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/15"
                    />
                    {mentionQuery !== null && (
                      <div className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-2xl border border-fg/10 bg-card shadow-2xl animate-fade-up">
                        {mentionResults.length === 0 ? (
                          <p className="px-4 py-3 text-[12px] text-fg/45">No members found…</p>
                        ) : (
                          mentionResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => pickMention(r)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-soft cursor-pointer"
                            >
                              <Avatar name={r.name} size={24} /> {r.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {supportsAudio && !audioData && !recording && (
                    <button
                      onClick={startRecording}
                      className="rounded-full p-2.5 text-fg/45 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                      title="Record a voice message"
                    >
                      <Mic size={17} />
                    </button>
                  )}
                  <Button
                    variant="dark"
                    className="rounded-full p-3"
                    onClick={submitMessage}
                    disabled={sendMessage.isPending || (!text.trim() && !audioData)}
                  >
                    {sendMessage.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
                {/* Room mode toggles — slim single row */}
                <div className="mt-1.5 flex items-center gap-2 px-1">
                  {activeRoom.allowAnonymous && me && (
                    <button
                      onClick={() => setAnonymous(!anonymous)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer",
                        anonymous
                          ? "border-flag-red bg-flag-red text-cream"
                          : "border-fg/15 text-fg/50 hover:border-flag-red hover:text-flag-red",
                      )}
                      title="Post without showing your name"
                    >
                      <UserPlus size={10} /> {anonymous ? "Anonymous on" : "Anonymous"}
                    </button>
                  )}
                  <button
                    onClick={() => setAudioOnly(!audioOnly)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer",
                      audioOnly
                        ? "border-flag-green bg-flag-green text-cream"
                        : "border-fg/15 text-fg/50 hover:border-flag-green hover:text-flag-green",
                    )}
                    title="Data saver — hide images & emojis, keep text and voice"
                  >
                    <Mic size={10} /> {audioOnly ? "Audio on" : "Audio"}
                  </button>
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
                  authorId={t.authorId}
                  authorName={t.authorName}
                  authorPoints={(t as any).authorPoints ?? 0}
                  authorRole={(t as any).authorRole ?? "member"}
                  createdAt={t.createdAt}
                  likes={t.likes}
                  replyCount={t.replyCount}
                  liked={me ? t.likedBy.includes(me.id) : false}
                  isMine={me ? t.authorId === me.id : false}
                  canModerate={
                    !!me &&
                    (me.role === "admin" ||
                      (me.role === "moderator" && me.managedRooms.includes(activeRoom.id)))
                  }
                  meId={me?.id ?? ""}
                  onLike={() => {
                    if (!me) return toast("Sign in to like", "error");
                    likeThread.mutate({ memberId: me.id, threadId: t.id });
                  }}
                  onReply={(text) => {
                    if (!me) return toast("Sign in to reply", "error");
                    replyToThread.mutate({ memberId: me.id, threadId: t.id, text });
                  }}
                  onEditThread={(title, body) => {
                    if (!me) return;
                    editThread.mutate({ memberId: me.id, threadId: t.id, title, body });
                  }}
                  onDeleteThread={() => {
                    if (!me) return;
                    deleteThread.mutate({ memberId: me.id, threadId: t.id });
                  }}
                  onEditReply={(replyId, text) => {
                    if (!me) return;
                    editReply.mutate({ memberId: me.id, replyId, text });
                  }}
                  onDeleteReply={(replyId) => {
                    if (!me) return;
                    deleteReply.mutate({ memberId: me.id, replyId });
                  }}
                  onReport={() => setReportTarget({ type: "thread", label: t.title })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete message confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="p-6 sm:p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-flag-red/10 text-flag-red">
            <Trash2 size={24} />
          </span>
          <p className="font-display text-xl font-bold">Delete this message?</p>
          <p className="mt-2 text-sm text-fg/60">
            {deleteTarget?.name && <strong className="text-fg">{deleteTarget.name}'s</strong>}{" "}
            message will be permanently removed for everyone.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (!me || !deleteTarget) return;
                deleteMsg.mutate({ memberId: me.id, messageId: deleteTarget.id });
                setDeleteTarget(null);
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        </div>
      </Modal>

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

      {/* Private messages */}
      <DmModal open={dmOpen} onClose={() => setDmOpen(false)} initialTarget={dmTarget} />

      {/* Share dialog */}
      <ShareModal open={!!shareTarget} onClose={() => setShareTarget(null)} target={shareTarget} />

      {/* Member profile (avatar click) */}
      <MemberModal
        memberId={profileMember}
        open={!!profileMember}
        onClose={() => setProfileMember(null)}
        onFollow={() => {
          if (!me || !profileMember) return;
          follow.mutate({ memberId: me.id, targetId: profileMember });
        }}
        onDm={() => {
          if (!me || !profileMember) return;
          setProfileMember(null);
          openDm({ authorId: profileMember, authorName: "Member" } as ChatMsg);
        }}
      />

      {/* New messages pill — appears when scrolled up from the latest */}
      {newMsgPill && (
        <button
          onClick={() => {
            chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: "smooth" });
            setNewMsgPill(false);
          }}
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-cream shadow-xl animate-fade-up cursor-pointer"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}

// ---------- Single chat message with reactions + actions ----------

function ChatMessage({
  m,
  me,
  depth,
  parentName,
  followed,
  canModerate,
  onReact,
  onReply,
  onSave,
  onShare,
  onFollow,
  onDm,
  onEdit,
  onDelete,
  editing,
  editText,
  onEditTextChange,
  onEditSave,
  onEditCancel,
  confirmingDelete,
  onReport,
  onRetry,
  verified,
  onProfile,
}: {
  m: ChatMsg;
  me: PublicMember | null;
  depth: number;
  parentName: string | null;
  followed: boolean;
  canModerate: boolean;
  onReact: (type: ReactionType) => void;
  onReply: () => void;
  onSave: () => void;
  onShare: () => void;
  onFollow: () => void;
  onDm: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  onEditTextChange: (t: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  confirmingDelete: boolean;
  onReport: () => void;
  onRetry?: () => void;
  verified?: boolean;
  onProfile: () => void;
}) {
  const mine = m.authorId === me?.id;
  const reactions = m.reactions ?? {};
  const saved = (m.savedBy ?? []).includes(me?.id ?? "");
  const hasReactions = Object.keys(reactions).length > 0;
  const indent = Math.min(depth, 2) * 44;
  const deleted = m.deleted;
  const pending = m.pending || m.failed;
  const displayName = m.anonymous ? "Anonymous" : m.authorName;

  return (
    <div className={cn("group", mine && "flex flex-col items-end")} style={{ marginLeft: mine ? 0 : indent }}>
      <div className={cn("flex gap-3", mine && "flex-row-reverse")}>
        <button
          onClick={onProfile}
          className="cursor-pointer shrink-0 rounded-full transition-opacity hover:opacity-80"
          title="View profile"
        >
          <Avatar name={m.anonymous ? "Anonymous" : m.authorName} size={34} />
        </button>
        <div className={cn("max-w-[78%] sm:max-w-[70%]", mine && "text-right")}>
          <div className={cn("mb-1 flex items-center gap-2 flex-wrap", mine && "justify-end")}>
            <span className="text-[12px] font-bold">{displayName}</span>
            {m.anonymous && (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold text-fg/50 uppercase tracking-wide">
                anonymous
              </span>
            )}
            {verified && (
              <span className="flex items-center gap-0.5 rounded-full bg-flag-green/10 px-2 py-0.5 text-[10px] font-bold text-flag-green">
                <CheckCircle2 size={10} /> Verified business
              </span>
            )}
            {!m.anonymous && <RankChip points={m.authorPoints} role={m.authorRole} />}
            <span className="text-[10px] text-fg/40">
              {!m.anonymous && regionName(m.authorRegion) ? `${regionName(m.authorRegion)} · ` : ""}
              {/* Timezone-aware: show local time + Ghana (GMT) time */}
              {localTime(m.sentAt)}
              {m.editedAt && !deleted && <span className="ml-1 italic text-fg/30">· edited</span>}
            </span>
          </div>

          {parentName && !deleted && (
            <p className={cn("mb-1 flex items-center gap-1 text-[11px] font-semibold text-flag-red/70", mine && "justify-end")}>
              <CornerDownRight size={11} /> in reply to {parentName}
            </p>
          )}

          {deleted ? (
            <div
              className={cn(
                "inline-block rounded-2xl px-4 py-2.5 text-left text-[13px] italic leading-relaxed text-fg/40",
                mine ? "bg-ink/60 rounded-br-sm" : "bg-soft/60 border border-dashed border-fg/15 rounded-bl-sm",
              )}
            >
              This message was deleted
            </div>
          ) : editing ? (
            <div className={cn("space-y-2", mine && "flex flex-col items-end")}>
              <textarea
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value)}
                autoFocus
                rows={2}
                className="w-full rounded-2xl border border-flag-gold/50 bg-card px-4 py-2.5 text-sm outline-none focus:border-flag-gold focus:ring-2 focus:ring-flag-gold/20"
              />
              <div className="flex items-center gap-2">
                <Button variant="dark" className="rounded-full px-4 py-1.5 text-xs" onClick={onEditSave}>
                  Save
                </Button>
                <Button variant="ghost" className="rounded-full px-4 py-1.5 text-xs" onClick={onEditCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                mine ? "bg-ink text-cream rounded-br-sm" : "bg-card border border-fg/5 rounded-bl-sm",
                (m.pending || m.failed) && "opacity-70",
              )}
            >
              {m.audio && (
                <audio
                  controls
                  src={m.audio}
                  preload="none"
                  className="mb-1.5 h-10 w-full max-w-[240px] rounded-xl sm:w-64"
                />
              )}
              {m.text && <MentionText text={m.text} mentions={m.mentions ?? []} />}
              {m.pending && (
                <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-fg/50">
                  <Loader2 size={11} className="animate-spin" /> sending…
                </span>
              )}
              {m.failed && (
                <button
                  onClick={onRetry}
                  className="mt-1.5 flex items-center gap-1.5 rounded-full bg-flag-red/10 px-2.5 py-1 text-[11px] font-bold text-flag-red hover:bg-flag-red/20 cursor-pointer"
                >
                  <RefreshCw size={11} /> Tap to retry
                </button>
              )}
            </div>
          )}

          {/* Reactions + actions */}
          {!deleted && !pending && (
            <div className={cn("mt-1.5 flex flex-wrap items-center gap-1", mine && "justify-end")}>
              {REACTIONS.map((r) => {
                const ids = reactions[r.type] ?? [];
                const count = ids.length;
                const reacted = ids.includes(me?.id ?? "");
                if (count === 0 && !reacted) {
                  return (
                    <button
                      key={r.type}
                      onClick={() => onReact(r.type)}
                      title={r.label}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink/5 pointer-coarse:opacity-100 cursor-pointer"
                    >
                      {r.emoji}
                    </button>
                  );
                }
                return (
                  <button
                    key={r.type}
                    onClick={() => onReact(r.type)}
                    title={`${r.label}${count > 0 ? ` — ${ids.length} ${ids.length === 1 ? "person" : "people"}` : ""}`}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors cursor-pointer",
                      reacted
                        ? "border-flag-gold bg-flag-gold/20 text-fg"
                        : "border-fg/10 bg-card text-fg/60 hover:border-flag-gold/60",
                    )}
                  >
                    <span>{r.emoji}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}

              <span className={cn("mx-0.5 hidden h-4 w-px bg-fg/10 sm:block", !hasReactions && "sm:hidden")} />

              <ActionBtn title="Reply" onClick={onReply}>
                <Reply size={13} />
              </ActionBtn>
              <ActionBtn title={saved ? "Remove bookmark" : "Save message"} onClick={onSave} active={saved}>
                <Bookmark size={13} className={saved ? "fill-flag-red text-flag-red" : ""} />
              </ActionBtn>
              <ActionBtn title="Share" onClick={onShare}>
                <Share2 size={13} />
              </ActionBtn>
              {mine && (
                <ActionBtn title="Edit message" onClick={onEdit}>
                  <Pencil size={13} />
                </ActionBtn>
              )}
              {mine && (
                <ActionBtn
                  title={confirmingDelete ? "Tap again to confirm delete" : "Delete message"}
                  onClick={onDelete}
                  danger
                >
                  <Trash2 size={13} className={confirmingDelete ? "text-flag-red" : ""} />
                </ActionBtn>
              )}
              {!mine && (
                <ActionBtn title={followed ? "Unfollow" : "Follow"} onClick={onFollow} active={followed}>
                  {followed ? <UserCheck size={13} /> : <UserPlus size={13} />}
                </ActionBtn>
              )}
              {!mine && (
                <ActionBtn title="Private message" onClick={onDm}>
                  <MessageCircle size={13} />
                </ActionBtn>
              )}
              {!mine && (
                <ActionBtn title="Report" onClick={onReport} danger>
                  <Flag size={13} />
                </ActionBtn>
              )}
              {canModerate && !mine && (
                <ActionBtn title="Delete (moderator)" onClick={onDelete} danger>
                  <Trash2 size={13} />
                </ActionBtn>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full text-fg/40 transition-colors cursor-pointer",
        active ? "text-flag-green" : danger ? "hover:text-flag-red hover:bg-flag-red/5" : "hover:text-fg hover:bg-ink/5",
      )}
    >
      {children}
    </button>
  );
}

// Renders @mentions in gold — highlights the names the sender tagged
function MentionText({
  text,
  mentions,
}: {
  text: string;
  mentions: Array<{ id: string; name: string }>;
}) {
  if (!mentions || mentions.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let rest = text;
  for (const m of mentions) {
    const idx = rest.toLowerCase().indexOf(`@${m.name.toLowerCase()}`);
    if (idx === -1) continue;
    parts.push(rest.slice(0, idx));
    parts.push(
      <span key={m.id} className="font-bold text-flag-red">
        @{m.name}
      </span>,
    );
    rest = rest.slice(idx + m.name.length + 1);
  }
  parts.push(rest);
  return <>{parts}</>;
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
  authorId,
  authorName,
  authorPoints,
  authorRole,
  createdAt,
  likes,
  replyCount,
  liked,
  isMine,
  canModerate,
  meId,
  onLike,
  onReply,
  onEditThread,
  onDeleteThread,
  onEditReply,
  onDeleteReply,
  onReport,
}: {
  threadId: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorPoints: number;
  authorRole: string;
  createdAt: string;
  likes: number;
  replyCount: number;
  liked: boolean;
  isMine: boolean;
  canModerate: boolean;
  meId: string;
  onLike: () => void;
  onReply: (text: string) => void;
  onEditThread: (title: string, body: string) => void;
  onDeleteThread: () => void;
  onEditReply: (replyId: string, text: string) => void;
  onDeleteReply: (replyId: string) => void;
  onReport: () => void;
}) {
  const [openReplies, setOpenReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editBody, setEditBody] = useState(body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyText, setEditReplyText] = useState("");
  const [confirmReplyDelete, setConfirmReplyDelete] = useState<string | null>(null);

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
            <p className="text-[11px] text-fg/40">
              {timeAgo(createdAt)}
              {data?.thread.editedAt && <span className="ml-1 italic text-fg/30">· edited</span>}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {isMine && (
              <button
                onClick={() => {
                  if (editing) {
                    setEditing(false);
                    setEditTitle(title);
                    setEditBody(body);
                  } else {
                    setEditing(true);
                    setEditTitle(title);
                    setEditBody(body);
                  }
                }}
                className="rounded-full p-2 text-fg/30 hover:text-flag-green hover:bg-flag-green/5 cursor-pointer"
                title={editing ? "Cancel edit" : "Edit discussion"}
              >
                <Pencil size={15} />
              </button>
            )}
            {(isMine || canModerate) && (
              <button
                onClick={() => {
                  if (confirmDelete) onDeleteThread();
                  else {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3000);
                  }
                }}
                className="rounded-full p-2 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                title={confirmDelete ? "Tap again to confirm delete" : "Delete discussion"}
              >
                <Trash2 size={15} className={confirmDelete ? "text-flag-red" : ""} />
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
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-flag-gold/50 bg-card px-4 py-2.5 text-sm font-semibold outline-none focus:border-flag-gold focus:ring-2 focus:ring-flag-gold/15"
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-flag-gold/50 bg-card px-4 py-3 text-sm outline-none focus:border-flag-gold focus:ring-2 focus:ring-flag-gold/15"
            />
            <div className="flex gap-2">
              <Button
                variant="dark"
                className="rounded-full px-4 py-1.5 text-xs"
                onClick={() => {
                  if (editTitle.trim().length < 3 || editBody.trim().length < 3) return;
                  onEditThread(editTitle.trim(), editBody.trim());
                  setEditing(false);
                }}
              >
                Save changes
              </Button>
              <Button variant="ghost" className="rounded-full px-4 py-1.5 text-xs" onClick={() => { setEditing(false); setEditTitle(title); setEditBody(body); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold leading-snug">{title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg/70">{body}</p>
          </>
        )}

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
            {data?.replies.map((r) => {
              const replyMine = r.authorId === meId;
              if (r.deleted) {
                return (
                  <div key={r.id} className="flex gap-3">
                    <Avatar name={r.authorName} size={30} />
                    <div className="rounded-2xl bg-soft/60 border border-dashed border-fg/15 px-4 py-2.5 text-[13px] italic text-fg/40">
                      This reply was deleted
                    </div>
                  </div>
                );
              }
              return (
                <div key={r.id} className="flex gap-3">
                  <Avatar name={r.authorName} size={30} />
                  <div className="flex-1">
                    <div className="rounded-2xl bg-card px-4 py-2.5 text-sm border border-fg/5">
                      <p className="text-[12px] font-bold">
                        {r.authorName}{" "}
                        <span className="ml-1 font-normal text-fg/35">
                          {timeAgo(r.createdAt)}
                          {r.editedAt && <span className="ml-1 italic">· edited</span>}
                        </span>
                      </p>
                      {editingReplyId === r.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editReplyText}
                            onChange={(e) => setEditReplyText(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-flag-gold/50 bg-card px-3 py-2 text-sm outline-none focus:border-flag-gold"
                          />
                          <div className="flex gap-2">
                            <Button variant="dark" className="rounded-full px-3 py-1 text-xs" onClick={() => { if (editReplyText.trim()) { onEditReply(r.id, editReplyText.trim()); setEditingReplyId(null); } }}>
                              Save
                            </Button>
                            <Button variant="ghost" className="rounded-full px-3 py-1 text-xs" onClick={() => setEditingReplyId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 leading-relaxed text-fg/75">{r.text}</p>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 pl-1">
                      {replyMine && (
                        <button
                          onClick={() => { setEditingReplyId(r.id); setEditReplyText(r.text); }}
                          className="rounded-full p-1.5 text-fg/30 hover:text-flag-green hover:bg-flag-green/5 cursor-pointer"
                          title="Edit reply"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {(replyMine || canModerate) && (
                        <button
                          onClick={() => {
                            if (confirmReplyDelete === r.id) onDeleteReply(r.id);
                            else {
                              setConfirmReplyDelete(r.id);
                              setTimeout(() => setConfirmReplyDelete((cur) => (cur === r.id ? null : cur)), 3000);
                            }
                          }}
                          className="rounded-full p-1.5 text-fg/30 hover:text-flag-red hover:bg-flag-red/5 cursor-pointer"
                          title={confirmReplyDelete === r.id ? "Tap again to confirm delete" : "Delete reply"}
                        >
                          <Trash2 size={12} className={confirmReplyDelete === r.id ? "text-flag-red" : ""} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
