import { useEffect, useRef, useState } from "react";
import { Menu, X, LayoutDashboard, LogOut, Sun, Moon, Globe, Check, MessagesSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Logo, LogoMark } from "@/client/lib/logo";
import { useStore } from "@/client/store";
import { Avatar, Button, Chip } from "./ui";
import { ProfileModal } from "./profile";
import { NotificationBell } from "./notifications";
import { DmModal } from "./dm-modal";
import { LANGS, useI18n } from "@/client/lib/i18n";
import { cn } from "@/client/lib/format";
import { queryClient } from "@/client/rpc-client";

export type Tab =
  | "home"
  | "community"
  | "projects"
  | "events"
  | "civic"
  | "economy"
  | "about"
  | "admin";

const LINKS: Array<{ tab: Tab; key: string }> = [
  { tab: "home", key: "home" },
  { tab: "community", key: "community" },
  { tab: "projects", key: "projects" },
  { tab: "events", key: "events" },
  { tab: "civic", key: "civic" },
  { tab: "economy", key: "economy" },
  { tab: "about", key: "about" },
];

export function Navbar({
  tab,
  onTab,
  onAuth,
  overDark = false,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onAuth: (mode: "login" | "signup") => void;
  overDark?: boolean;
}) {
  const { user, logout } = useStore();
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  // Default follows the visitor's device preference; a manual toggle wins and is remembered
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("adom_theme");
    if (saved) return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  const langRef = useRef<HTMLDivElement>(null);

  const solid = scrolled || open || !overDark;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("adom_theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: dmUnread } = useQuery(
    queryClient.dms.unreadTotal.queryOptions({
      input: { memberId: user?.id ?? "" },
      enabled: !!user,
      refetchInterval: 30_000,
    }),
  );

  const go = (t: Tab) => {
    onTab(t);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className={cn(
        "relative transition-all duration-300",
        solid
          ? "bg-page/90 backdrop-blur-xl border-b border-fg/5 shadow-[0_2px_20px_rgba(13,31,23,0.08)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
        <button onClick={() => go("home")} className="cursor-pointer shrink-0">
          {solid ? (
            <Logo size={38} />
          ) : (
            <div className="flex items-center gap-3">
              <LogoMark size={38} />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-2xl tracking-[0.14em] text-cream">
                  ADOM
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="flag-stripes h-[3px] w-6 rounded-full" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-cream/80">
                    Circle · Ghana
                  </span>
                </span>
              </div>
            </div>
          )}
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <button
              key={l.tab}
              onClick={() => go(l.tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                tab === l.tab
                  ? "bg-ink text-cream"
                  : solid
                    ? "text-fg/70 hover:text-fg hover:bg-ink/5"
                    : "text-cream/80 hover:text-cream hover:bg-white/10",
              )}
            >
              {t(l.key)}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(!dark)}
            className={cn(
              "hidden sm:flex rounded-full p-2.5 transition-colors cursor-pointer",
              solid ? "text-fg/70 hover:text-fg hover:bg-ink/5" : "text-cream/80 hover:text-cream hover:bg-white/10",
            )}
            aria-label="Toggle dark mode"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language switcher */}
          <div className="relative hidden sm:block" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className={cn(
                "rounded-full p-2.5 transition-colors cursor-pointer",
                solid ? "text-fg/70 hover:text-fg hover:bg-ink/5" : "text-cream/80 hover:text-cream hover:bg-white/10",
              )}
              aria-label="Language"
              title="Language"
            >
              <Globe size={18} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-12 z-[70] w-44 overflow-hidden rounded-2xl border border-fg/10 bg-card shadow-2xl animate-fade-up">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer",
                      lang === l.code ? "bg-flag-gold/15 text-flag-red" : "text-fg/70 hover:bg-soft",
                    )}
                  >
                    <span>{l.native}</span>
                    {lang === l.code && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user && (
            <button
              onClick={() => setDmOpen(true)}
              className={cn(
                "relative rounded-full p-2.5 transition-colors cursor-pointer",
                solid ? "text-fg/70 hover:text-fg hover:bg-ink/5" : "text-cream/80 hover:text-cream hover:bg-white/10",
              )}
              aria-label="Private messages"
              title="Private messages"
            >
              <MessagesSquare size={18} />
              {(dmUnread ?? 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-flag-red px-1 text-[10px] font-bold text-cream">
                  {dmUnread! > 9 ? "9+" : dmUnread}
                </span>
              )}
            </button>
          )}

          {user && <NotificationBell onNavigate={(tab) => go(tab as Tab)} onOpenDm={() => setDmOpen(true)} />}

          {user ? (
            <>
              {user.role === "admin" && (
                <button
                  onClick={() => go("admin")}
                  className={cn(
                    "hidden sm:inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold cursor-pointer transition-colors",
                    tab === "admin"
                      ? "bg-flag-red text-cream border-flag-red"
                      : solid
                        ? "border-fg/20 text-fg hover:border-flag-red hover:text-flag-red"
                        : "border-cream/30 text-cream hover:border-cream",
                  )}
                >
                  <LayoutDashboard size={16} />
                  Admin
                </button>
              )}
              <button
                onClick={() => setProfileOpen(true)}
                className="cursor-pointer"
                title={user.name}
              >
                <Avatar name={user.name} size={38} className="ring-2 ring-flag-gold" />
              </button>
              <button
                onClick={() => {
                  logout();
                  go("home");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-fg/50 hover:text-flag-red transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => onAuth("login")}
                className={cn(!solid && "text-cream hover:bg-card/10")}
              >
                {t("signin")}
              </Button>
              <Button variant="gold" onClick={() => onAuth("signup")}>
                {t("join")}
              </Button>
            </div>
          )}

          <button
            className={cn(
              "lg:hidden rounded-full p-2 cursor-pointer",
              solid ? "text-fg" : "text-cream",
            )}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-fg/10 bg-page px-4 py-4 animate-fade-in">          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <button
                key={l.tab}
                onClick={() => go(l.tab)}
                className={cn(
                  "rounded-xl px-4 py-3 text-left text-base font-semibold cursor-pointer",
                  tab === l.tab ? "bg-ink text-cream" : "text-fg/70 hover:bg-ink/5",
                )}
              >
                {t(l.key)}
              </button>
            ))}
            {user?.role === "admin" && (
              <button
                onClick={() => go("admin")}
                className="rounded-xl px-4 py-3 text-left text-base font-semibold text-flag-red hover:bg-flag-red/5 cursor-pointer"
              >
                Admin Panel
              </button>
            )}
            {user ? (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-soft px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} size={36} />
                  <div>
                    <p className="text-sm font-bold">{user.name}</p>
                    <Chip tone="green" className="mt-0.5 capitalize">{user.role}</Chip>
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    go("home");
                  }}
                  className="rounded-full bg-ink/5 p-2 text-fg/60 hover:text-flag-red cursor-pointer"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onAuth("login")}>
                  {t("signin")}
                </Button>
                <Button variant="gold" className="flex-1" onClick={() => onAuth("signup")}>
                  {t("joinfree")}
                </Button>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 border-t border-fg/10 pt-3">
              <button
                onClick={() => setDark(!dark)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-soft px-3 py-2.5 text-sm font-semibold text-fg/70 cursor-pointer"
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
                {dark ? "Light mode" : "Dark mode"}
              </button>
              <div className="relative flex-1" ref={langRef}>
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-soft px-3 py-2.5 text-sm font-semibold text-fg/70 cursor-pointer"
                >
                  <Globe size={15} /> {LANGS.find((l) => l.code === lang)?.native ?? "Language"}
                </button>
                {langOpen && (
                  <div className="absolute bottom-full left-0 z-[70] mb-1 w-full overflow-hidden rounded-2xl border border-fg/10 bg-card shadow-2xl animate-fade-up">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLang(l.code);
                          setLangOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer",
                          lang === l.code ? "bg-flag-gold/15 text-flag-red" : "text-fg/70 hover:bg-soft",
                        )}
                      >
                        <span>{l.native}</span>
                        {lang === l.code && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <DmModal open={dmOpen} onClose={() => setDmOpen(false)} />
    </header>
  );
}
