import { LogoMark } from "@/client/lib/logo";
import { FlagStripes } from "@/client/lib/logo";
import { useI18n } from "@/client/lib/i18n";
import { SocialLinks, type SocialLink } from "./socials";
import type { Tab } from "./navbar";

export function Footer({
  onTab,
  footerText,
  socials = [],
}: {
  onTab: (t: Tab) => void;
  footerText: string;
  socials?: SocialLink[];
}) {
  const { t } = useI18n();
  return (
    <footer className="bg-ink text-cream">
      <FlagStripes className="h-1 rounded-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <LogoMark size={46} />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-2xl tracking-[0.14em]">ADOM</span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="flag-stripes h-[3px] w-6 rounded-full" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-gold-soft">
                    Circle · Ghana
                  </span>
                </span>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/60">
              One Circle. One Ghana. We unite Ghanaians at home and abroad to
              contribute to peace, development and prosperity — under one
              Constitution, above every institution.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cream/40">
                Connect
              </span>
              <SocialLinks socials={socials} tone="light" />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-soft mb-4">{t("explore")}</p>
            <ul className="space-y-2.5 text-sm">
              {(
                [
                  ["home", "Home"],
                  ["community", "Community & Forum"],
                  ["projects", "Projects & Impact"],
                  ["events", "Events & Activities"],
                  ["civic", "Civic & Voting"],
                  ["economy", "Economy Hub"],
                  ["about", "About & Values"],
                ] as Array<[Tab, string]>
              ).map(([t2, label]) => (
                <li key={t2}>
                  <button onClick={() => onTab(t2)} className="text-cream/60 hover:text-flag-gold transition-colors cursor-pointer">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-soft mb-4">Our Foundation</p>
            <ul className="space-y-2.5 text-sm text-cream/60">
              <li>The Constitution of Ghana is supreme — above any denomination, institution or group.</li>
              <li>We respect religious freedom and peaceful coexistence.</li>
              <li>Peace, stability and values are protected by engaged citizens.</li>
              <li>Every Ghanaian is welcome.</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-cream/50">{footerText}</p>
          <p className="text-xs text-cream/50">
            Built with pride for Ghana · 🇬🇭 Black Star forever
          </p>
        </div>
      </div>
    </footer>
  );
}
