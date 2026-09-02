import { useState } from "react";
import { Link2, Check, Share2, Mail, MoreHorizontal } from "lucide-react";
import { Modal } from "./ui";
import { WhatsAppIcon, FacebookIcon, XIcon, TelegramIcon } from "@/client/lib/brand-icons";
import { useStore } from "@/client/store";
import { cn } from "@/client/lib/format";

const SITE_URL = "https://adomcircle.org";

export type ShareTarget = {
  text: string;
  authorName?: string;
  roomName?: string;
  // Where the shared link should land (e.g. "/civic#voice"). Defaults to the
  // community page for chat shares.
  url?: string;
};

// Share dialog with real social buttons + copy link.
// - Social buttons open their platform with the message pre-filled (text + link).
// - Copy link copies the direct URL (plus a short caption) so people can paste
//   it into any app.
// - On phones, "More options" opens the native share sheet.
export function ShareModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget | null;
}) {
  const { toast } = useStore();
  const [copied, setCopied] = useState(false);
  if (!open || !target) return null;

  const shareUrl = target.url ? `${SITE_URL}${target.url}` : `${SITE_URL}/community`;
  const caption = target.text
    ? `"${target.text.length > 120 ? target.text.slice(0, 120) + "…" : target.text}"${
        target.authorName ? ` — ${target.authorName}` : ""
      }${target.roomName ? `, in #${target.roomName}` : ""} on Adom Circle 🇬🇭`
    : `Join the conversation on Adom Circle 🇬🇭`;
  const shareText = `${caption}\n${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("Link copied — paste it anywhere to share");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy the link", "error");
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast("Message + link copied — paste it anywhere to share");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  const nativeShare = () => {
    if (navigator.share) {
      navigator
        .share({ text: shareText, url: shareUrl })
        .catch(() => {});
    } else {
      toast("Native sharing isn't available on this device", "error");
    }
  };

  const platforms = [
    {
      name: "WhatsApp",
      icon: <WhatsAppIcon size={20} />,
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      bg: "#25D366",
      fg: "#fff",
    },
    {
      name: "Facebook",
      icon: <FacebookIcon size={20} />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(caption)}`,
      bg: "#1877F2",
      fg: "#fff",
    },
    {
      name: "X",
      icon: <XIcon size={20} />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(shareUrl)}`,
      bg: "#000000",
      fg: "#fff",
    },
    {
      name: "Telegram",
      icon: <TelegramIcon size={20} />,
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(caption)}`,
      bg: "#26A5E4",
      fg: "#fff",
    },
    {
      name: "Email",
      icon: <Mail size={20} />,
      href: `mailto:?subject=${encodeURIComponent("Adom Circle — join the conversation")}&body=${encodeURIComponent(shareText)}`,
      bg: "#7C4A03",
      fg: "#fff",
    },
  ];

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <p className="mb-1 flex items-center gap-2 font-display text-xl font-bold">
          <Share2 size={18} className="text-flag-red" /> Share
        </p>
        <p className="mb-5 text-sm text-fg/55">
          Spread the conversation — pick a platform, or copy the link.
        </p>

        {/* Message preview */}
        <div className="mb-6 rounded-2xl border border-fg/10 bg-soft/60 p-4">
          <p className="line-clamp-3 text-[13px] leading-relaxed text-fg/75">{target.text}</p>
          <p className="mt-2 text-[11px] font-semibold text-fg/40">
            {target.authorName}
            {target.roomName ? ` · #${target.roomName}` : ""} · adomcircle.org
          </p>
        </div>

        {/* Platform buttons */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                // Fire the toast after opening the platform
                setTimeout(() => toast(`Opening ${p.name}…`), 50);
              }}
              className="group flex flex-col items-center gap-2"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
                style={{ background: p.bg }}
              >
                {p.icon}
              </span>
              <span className="text-[11px] font-semibold text-fg/60">{p.name}</span>
            </a>
          ))}
        </div>

        {/* Copy options */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={copyLink}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer",
              copied
                ? "border-flag-green bg-flag-green/10 text-flag-green"
                : "border-fg/15 text-fg hover:border-flag-red hover:text-flag-red",
            )}
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={copyText}
            className="flex items-center justify-center gap-2 rounded-full border border-fg/15 px-4 py-2.5 text-sm font-bold text-fg hover:border-flag-red hover:text-flag-red transition-colors cursor-pointer"
          >
            <Link2 size={15} /> Copy text + link
          </button>
        </div>

        {/* Native share on phones */}
        {typeof navigator !== "undefined" && !!navigator.share && (
          <button
            onClick={nativeShare}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-cream hover:bg-ink-2 transition-colors cursor-pointer"
          >
            <MoreHorizontal size={15} /> More options (all apps)
          </button>
        )}
      </div>
    </Modal>
  );
}
