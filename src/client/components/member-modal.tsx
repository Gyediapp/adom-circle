import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Briefcase, Church, Award, Trophy, BadgeCheck, UserPlus, UserCheck, MessageCircle, CalendarDays, Check, X, Clock } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Modal, Avatar, Button, Chip } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { regionName } from "@/server/data/regions";
import { cn, isOnline, presenceLabel } from "@/client/lib/format";

// Lightweight member profile — opens when you tap any avatar in the chat.
// Respects the member's privacy settings (what they've chosen to show).
// Friendship is mutual: you send a request, they accept, then you're friends.
export function MemberModal({
  memberId,
  open,
  onClose,
  onDm,
}: {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onDm?: () => void;
}) {
  const { user, toast, refresh } = useStore();
  const qc = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: member } = useQuery(
    queryClient.members.byId.queryOptions({
      input: memberId ?? "",
      enabled: open && !!memberId,
    }),
  );

  const isMe = member?.id === user?.id;
  const { data: reqs } = useQuery(
    queryClient.members.friendRequests.queryOptions({
      input: { memberId: user?.id ?? "" },
      enabled: open && !!member && !!user && !isMe,
    }),
  );

  // Relationship state with the person in the modal
  const isFriend = !!member && (user?.friends ?? []).includes(member.id);
  const incomingReq = reqs?.incoming.find((r) => r.fromId === member?.id);
  const outgoingReq = reqs?.outgoing.find((r) => r.toId === member?.id);

  const refreshAll = async () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    await refresh();
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      await refreshAll();
    } catch (e: any) {
      toast(e?.message ?? "Failed", "error");
    }
  };

  if (!open || !member) return null;
  const p = member.privacy ?? { showRegion: true, showHometown: true, showProfession: true, showBadges: true, showPoints: true };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Avatar name={member.name} size={76} className="ring-2 ring-flag-gold" />
          <div className="mt-3 flex items-center gap-2">
            <p className="font-display text-xl font-bold">{member.name}</p>
            <span
              className={cn("h-2.5 w-2.5 rounded-full", isOnline(member.lastSeenAt) ? "bg-flag-green" : "bg-fg/20")}
              title={presenceLabel(member.lastSeenAt)}
            />
            {member.verified && <BadgeCheck size={18} className="text-flag-green" />}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-fg/45">{presenceLabel(member.lastSeenAt)}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <RankChip points={member.points} role={member.role} size="md" />
            {member.verified && (
              <Chip tone="green" className="text-[10px]">
                <BadgeCheck size={10} /> Verified business
              </Chip>
            )}
          </div>
          {!isMe && (
            <p className="mt-1.5 text-[11px] font-semibold text-fg/45">
              {(member.friends ?? []).length} friends
            </p>
          )}
          {member.bio && <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-fg/60">{member.bio}</p>}
          <p className="mt-2 text-[11px] font-semibold text-fg/40">
            Member since {new Date(member.joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Details (respecting privacy) */}
        <div className="mt-5 space-y-2">
          {p.showRegion && member.region && (
            <Row icon={<MapPin size={14} />} label="Region" value={regionName(member.region)} />
          )}
          {p.showHometown && member.hometown && (
            <Row icon={<MapPin size={14} />} label="Hometown" value={member.hometown} />
          )}
          {member.diasporaCountry && (
            <Row icon={<CalendarDays size={14} />} label="Diaspora" value={member.diasporaCountry} />
          )}
          {p.showProfession && member.profession && (
            <Row icon={<Briefcase size={14} />} label="Profession" value={member.profession} />
          )}
          {member.church && (
            <Row icon={<Church size={14} />} label="Church" value={member.church} />
          )}
          {p.showBadges && member.badges.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {member.badges.slice(0, 5).map((b) => (
                <Chip key={b} tone="sand" className="px-2 py-0.5 text-[10px]">
                  <Award size={10} /> {b}
                </Chip>
              ))}
            </div>
          )}
          {p.showPoints && (
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[12px] font-bold text-fg/50">
              <Trophy size={13} className="text-flag-gold" />
              {member.points.toLocaleString()} points · {member.followerCount ?? 0} followers
            </div>
          )}
        </div>

        {/* Actions — friendship is mutual (request → accept) */}
        {!isMe && (
          <div className="mt-6 space-y-2">
            {isFriend ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!confirmRemove) {
                    setConfirmRemove(true);
                    setTimeout(() => setConfirmRemove(false), 3000);
                    return;
                  }
                  setConfirmRemove(false);
                  act(
                    () => rpcClient.members.removeFriend({ memberId: user!.id, friendId: member.id }),
                    "Friend removed",
                  );
                }}
              >
                {confirmRemove ? (
                  <>
                    <X size={15} /> Tap again to remove friend
                  </>
                ) : (
                  <>
                    <UserCheck size={15} className="text-flag-green" /> Friends
                  </>
                )}
              </Button>
            ) : incomingReq ? (
              <>
                <Button
                  variant="gold"
                  className="w-full"
                  onClick={() =>
                    act(
                      () => rpcClient.members.respondFriendRequest({ memberId: user!.id, requestId: incomingReq.id, accept: true }),
                      `${member.name} is now your friend 🎉`,
                    )
                  }
                >
                  <Check size={15} /> Accept friend request
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-fg/50"
                  onClick={() =>
                    act(
                      () => rpcClient.members.respondFriendRequest({ memberId: user!.id, requestId: incomingReq.id, accept: false }),
                      "Request declined",
                    )
                  }
                >
                  <X size={15} /> Decline
                </Button>
              </>
            ) : outgoingReq ? (
              <div className="space-y-2">
                <Button variant="outline" className="w-full" disabled>
                  <Clock size={15} /> Request sent — waiting for {member.name.split(" ")[0]}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-fg/50"
                  onClick={() =>
                    act(
                      () => rpcClient.members.cancelFriendRequest({ memberId: user!.id, requestId: outgoingReq.id }),
                      "Request cancelled",
                    )
                  }
                >
                  <X size={15} /> Cancel request
                </Button>
              </div>
            ) : (
              <Button
                variant="gold"
                className="w-full"
                onClick={() =>
                  act(
                    () => rpcClient.members.sendFriendRequest({ memberId: user!.id, targetId: member.id }),
                    `Friend request sent to ${member.name.split(" ")[0]} 🤝`,
                  )
                }
              >
                <UserPlus size={15} /> Add friend
              </Button>
            )}
            <Button variant="dark" className="w-full" onClick={onDm}>
              <MessageCircle size={15} /> Message
            </Button>
          </div>
        )}
        {isMe && (
          <p className="mt-5 text-center text-[12px] text-fg/45">
            This is you. Privacy options are on your profile.
          </p>
        )}
        {user && !isMe && user.points < 20 && onDm && (
          <p className="mt-2 text-center text-[11px] text-fg/40">
            Private messaging unlocks at 20 points.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-soft/50 px-3.5 py-2">
      <span className="text-flag-red">{icon}</span>
      <span className="text-[12px] font-bold uppercase tracking-wider text-fg/45">{label}</span>
      <span className="ml-auto text-[13px] font-semibold text-fg/80">{value}</span>
    </div>
  );
}
