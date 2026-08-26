import { Globe } from "lucide-react";
import { cn } from "@/client/lib/format";
import { FacebookIcon, WhatsAppIcon, YouTubeIcon, TikTokIcon } from "@/client/lib/brand-icons";

export type SocialLink = {
  platform: "facebook" | "whatsapp" | "youtube" | "tiktok" | "other";
  label: string;
  url: string;
};

const ICONS = {
  facebook: FacebookIcon,
  whatsapp: WhatsAppIcon,
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  other: Globe,
};

// Render social links from site settings — used in hero, footer, and About
export function SocialLinks({
  socials,
  tone = "dark",
  className,
}: {
  socials: SocialLink[];
  tone?: "dark" | "light";
  className?: string;
}) {
  const visible = socials.filter((s) => s.url && s.url !== "#");
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {visible.map((s) => {
        const Icon = ICONS[s.platform] ?? Globe;
        return (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className={cn(
              "rounded-full p-2.5 transition-all duration-200 hover:-translate-y-0.5",
              tone === "dark"
                ? "bg-ink/5 text-fg/60 hover:bg-flag-red hover:text-cream"
                : "bg-white/10 text-cream/80 hover:bg-flag-gold hover:text-ink",
            )}
          >
            <Icon size={17} />
          </a>
        );
      })}
    </div>
  );
}
