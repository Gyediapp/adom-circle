import { useQuery } from "@tanstack/react-query";
import { MapPin, Briefcase, Church, Award, Trophy, BadgeCheck, UserPlus, UserCheck, MessageCircle, CalendarDays } from "lucide-react";
import { queryClient } from "@/client/rpc-client";
import { useStore } from "@/client/store";
import { Modal, Avatar, Button, Chip } from "./ui";
import { RankChip } from "@/client/lib/ranks";
import { regionName } from "@/server/data/regions";

// Lightweight member profile — opens when you tap any avatar in the chat.
// Respects the member's privacy settings (what they've chosen to show).
export function MemberModal({
  memberId,
  open,
  onClose,
  onFollow,
  onDm,
}: {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onFollow?: () => void;
  onDm?: () => void;
}) {
  const { user, toast } = useStore();
  const { data: member } = useQuery(
    queryClient.members.byId.queryOptions({
      input: memberId ?? "",
      enabled: open && !!memberId,
    }),
  );

  if (!open || !member) return null;
  const isMe = member.id === user?.id;
  const p = member.privacy ?? { showRegion: true, showHometown: true, showProfession: true, showBadges: true, showPoints: true };
  const following = user?.following?.includes(member.id) ?? false;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Avatar name={member.name} size={76} className="ring-2 ring-flag-gold" />
          <div className="mt-3 flex items-center gap-2">
            <p className="font-display text-xl font-bold">{member.name}</p>
            {member.verified && (
              <BadgeCheck size={18} className="text-flag-green" />
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <RankChip points={member.points} role={member.role} size="md" />
            {member.verified && (
              <Chip tone="green" className="text-[10px]">
                <BadgeCheck size={10} /> Verified business
              </Chip>
            )}
          </div>
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

        {!isMe && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button
              variant={following ? "outline" : "gold"}
              onClick={onFollow}
              className="w-full"
            >
              {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {following ? "Following" : "Follow"}
            </Button>
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
