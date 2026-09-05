import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, ArrowUp, ShieldAlert, Mail } from "lucide-react";
import { queryClient, rpcClient } from "@/client/rpc-client";
import { StoreProvider, useStore } from "@/client/store";
import { Navbar, type Tab } from "@/client/components/navbar";
import { Footer } from "@/client/components/footer";
import { AuthModal } from "@/client/components/auth-modal";
import { Home } from "@/client/components/home";
import { Community } from "@/client/components/community";
import { Projects } from "@/client/components/projects";
import { Events } from "@/client/components/events";
import { Civic } from "@/client/components/civic";
import { Economy } from "@/client/components/economy";
import { About } from "@/client/components/about";
import { Blog } from "@/client/components/blog";
import { Admin } from "@/client/components/admin";
import { LogoMark, Star } from "@/client/lib/logo";
import { LangProvider, useI18n } from "@/client/lib/i18n";
import { cn } from "@/client/lib/format";

const VALID_TABS: Tab[] = [
  "home",
  "community",
  "blog",
  "projects",
  "events",
  "civic",
  "economy",
  "about",
  "admin",
];

// Read the page from the URL: "/community" or "#/community" → "community"
function tabFromURL(): Tab {
  const path = window.location.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  const candidate = h || path;
  return (VALID_TABS as string[]).includes(candidate) ? (candidate as Tab) : "home";
}

function Shell() {
  const [tab, setTabState] = useState<Tab>(tabFromURL);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const { user, loading, toasts, toast } = useStore();
  const { t } = useI18n();
  const [verifying, setVerifying] = useState(false);

  const { data: settings } = useQuery(queryClient.site.get.queryOptions());

  // Ticker: never disappear even if old stored settings lack the field — the
  // server merges defaults, this is a belt-and-braces client fallback.
  const TICKER_FALLBACK = "Register to vote · Know the Constitution · Peace is everyone's duty 🇬🇭";
  const tickerText = settings?.ticker?.text || TICKER_FALLBACK;
  const showTicker = settings ? (settings.ticker?.enabled ?? true) : true;

  // PWA: register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const onAuth = (m: "login" | "signup") => setAuthMode(m);

  // Navigate + update the URL so each page has its own clean address (/events)
  const onTab = useCallback((t: Tab) => {
    setTabState(t);
    const target = t === "home" ? "/" : `/${t}`;
    if (window.location.pathname !== target) {
      window.history.pushState(null, "", target);
    }
    // Normalise legacy #/hash links away
    if (window.location.hash) {
      window.history.replaceState(null, "", target);
    }
  }, []);

  // Support the browser back/forward buttons + legacy hash links
  useEffect(() => {
    const onPop = () => setTabState(tabFromURL());
    const onHash = () => setTabState(tabFromURL());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  // Dark hero pages: transparent navbar with light text until scrolled
  const overDark =
    tab === "home" || tab === "civic" || tab === "economy" || tab === "about" || tab === "events";

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink text-cream">
        <LogoMark size={72} className="animate-pulse-soft" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-cream/60">Adom Circle</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Fixed header stack: ticker + announcement + navbar */}
      <div className="fixed inset-x-0 top-0 z-50">
        {showTicker && tickerText && <Ticker text={tickerText} />}
        {settings?.announcement.enabled && (
          <div className="flag-stripes flex items-center justify-center gap-2 px-4 py-2 text-center text-[12.5px] font-bold tracking-wide text-ink">
            <Star size={13} className="shrink-0" aria-hidden />
            <span>{settings.announcement.text}</span>
          </div>
        )}
        <Navbar tab={tab} onTab={onTab} onAuth={onAuth} overDark={overDark} />
      </div>

      {/* Unverified email banner */}
      {user && !user.emailVerified && (
        <div className="fixed inset-x-0 top-[104px] z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 px-4">
          <div className="flex w-full items-center gap-3 rounded-2xl border border-flag-gold/60 bg-flag-gold/15 px-4 py-2.5 backdrop-blur-md animate-fade-up">
            <ShieldAlert size={17} className="shrink-0 text-clay" />
            <p className="flex-1 text-[13px] font-semibold text-fg">
              Verify your email to fully activate your account.
            </p>
            <button
              onClick={async () => {
                if (verifying) return;
                setVerifying(true);
                try {
                  const res = await rpcClient.members.resendVerification({ email: user.email });
                  toast(res.devCode ? `New code sent! (Demo: ${res.devCode})` : "New code sent to your email!");
                } catch (e: any) {
                  toast(e?.message ?? "Failed to resend", "error");
                } finally {
                  setVerifying(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-cream hover:bg-ink-2 transition-colors cursor-pointer"
            >
              <Mail size={12} /> Resend code
            </button>
          </div>
        </div>
      )}

      <main className={cn(tab !== "home" && "min-h-[70vh]")}>
        <ErrorBoundary>
          {tab === "home" && <Home onTab={onTab} onAuth={onAuth} />}
          {tab === "community" && <Community />}
          {tab === "blog" && <Blog />}
          {tab === "projects" && <Projects />}
          {tab === "events" && <Events />}
          {tab === "civic" && <Civic />}
          {tab === "economy" && <Economy onTab={onTab} />}
          {tab === "about" && <About />}
          {tab === "admin" && <Admin />}
        </ErrorBoundary>
      </main>

      <Footer onTab={onTab} footerText={settings?.footer ?? "Adom Circle — uniting Ghanaians under one Constitution."} socials={settings?.socials ?? []} />

      {/* Back to top */}
      <BackToTop />

      {/* Auth modal */}
      <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitchMode={setAuthMode} />

      {/* Toasts */}
      <div className="fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-cream shadow-2xl animate-fade-up",
              t.kind === "success" ? "bg-ink dark:border dark:border-cream/15" : "bg-flag-red",
            )}
          >
            {t.kind === "success" ? <CheckCircle2 size={17} className="shrink-0 text-flag-gold" /> : <AlertCircle size={17} className="shrink-0" />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Signed-in helper chip */}
      {user && tab === "home" && (
        <div className="fixed bottom-5 right-5 z-40 hidden sm:flex items-center gap-2 rounded-full bg-card shadow-xl border border-fg/10 px-4 py-2.5 text-sm font-bold text-fg">
          <span className="flex h-2.5 w-2.5 rounded-full bg-flag-green animate-pulse-soft" />
          {t("welcome")}, {user.name.split(" ")[0]} 🇬🇭
        </div>
      )}
    </div>
  );
}

// Friendly error guard — if any page ever crashes, show a message + reload button
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-md px-4 pt-40 pb-20 text-center">
          <p className="font-display text-2xl font-bold">Something went wrong on this page</p>
          <p className="mt-2 text-sm text-fg/55">{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="mt-5 cursor-pointer rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream"
          >
            Reload the page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Self-driven scrolling ticker. Animated with requestAnimationFrame instead of
// CSS so it can't be disabled by prefers-reduced-motion or missing Tailwind
// classes — the ticker always scrolls. Pauses while the pointer hovers it.
function Ticker({ text }: { text: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let x = 0;
    let last = performance.now();
    let paused = false;
    const SPEED = 42; // pixels per second
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp tab-switch jumps
      last = now;
      if (!paused) {
        x -= SPEED * dt;
        const half = el.scrollWidth / 2;
        // Loop seamlessly: the content is 4 identical copies, so resetting at
        // the halfway point (2 copies) joins perfectly.
        if (half > 0 && -x >= half) x += half;
        el.style.transform = `translate3d(${x}px,0,0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [text]);

  return (
    <div className="relative z-10 overflow-hidden bg-ink py-1.5 text-cream">
      <div
        ref={trackRef}
        className="flex w-max items-center whitespace-nowrap text-[12px] font-semibold tracking-wide will-change-transform"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="flex items-center">
            <Star size={11} className="mx-2.5 text-flag-gold" aria-hidden />
            <span>{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-5 z-40 rounded-full bg-flag-red p-3 text-cream shadow-2xl hover:bg-[#a80d1e] transition-colors cursor-pointer"
      aria-label="Back to top"
    >
      <ArrowUp size={18} />
    </button>
  );
}

export default function App() {
  return (
    <LangProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </LangProvider>
  );
}
