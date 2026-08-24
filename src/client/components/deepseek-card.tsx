import { useEffect, useState } from "react";
import { Clock, Moon, Sun, Zap, Cpu, Eye, TrendingDown, Info } from "lucide-react";
import { useStore } from "@/client/store";
import { Card, Chip } from "./ui";
import { cn } from "@/client/lib/format";

// DeepSeek off-peak window: 16:30 UTC → 00:30 UTC (50% discount).
// Peak: 00:30 UTC → 16:30 UTC (full price).
const OFF_PEAK_START = 16 * 60 + 30; // 990 min
const OFF_PEAK_END = 0 * 60 + 30; // 30 min (next day)

function minsOf(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isOffPeak(d: Date): boolean {
  const m = minsOf(d);
  return m >= OFF_PEAK_START || m < OFF_PEAK_END;
}

function nextFlip(d: Date): Date {
  const m = minsOf(d);
  const flip = new Date(d);
  if (m >= OFF_PEAK_START) {
    // off-peak now → flip at 00:30 UTC next day
    flip.setUTCHours(0, 30, 0, 0);
    flip.setUTCDate(flip.getUTCDate() + 1);
  } else if (m < OFF_PEAK_END) {
    // off-peak now (early morning) → flip at 16:30 UTC today
    flip.setUTCHours(16, 30, 0, 0);
  } else {
    // peak now → flip at 16:30 UTC today
    flip.setUTCHours(16, 30, 0, 0);
  }
  return flip;
}

const pad = (n: number) => String(n).padStart(2, "0");

const MODELS = [
  {
    name: "DeepSeek-V3.2-Exp",
    best: "Everyday chat, code, writing — best value per token",
    vision: "✗ No image input",
    price: "~$0.28 in / $0.42 out per 1M (miss/cache-hit: $0.028)",
  },
  {
    name: "DeepSeek-R1",
    best: "Deep math, logic, hard reasoning — thinks step by step",
    vision: "✗ No image input",
    price: "~$0.55 in / $2.19 out per 1M (cache hit $0.14)",
  },
  {
    name: "DeepSeek-VL2 (open weights)",
    best: "Vision-language: reads documents, charts, images",
    vision: "✓ Yes — but NOT on the official API; self-host or via OpenRouter-style gateways",
    price: "Free weights — you pay only for hosting",
  },
];

export function DeepSeekRateCard() {
  const { toast } = useStore();
  const [now, setNow] = useState(new Date());
  const [prevOffPeak, setPrevOffPeak] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const offPeak = isOffPeak(now);
  const flip = nextFlip(now);
  const ms = Math.max(0, flip.getTime() - now.getTime());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  // Toast exactly once when the window flips
  useEffect(() => {
    if (prevOffPeak === null) {
      setPrevOffPeak(offPeak);
      return;
    }
    if (prevOffPeak !== offPeak) {
      toast(
        offPeak
          ? "DeepSeek OFF-PEAK has started — 50% off, now is the cheap time! ⏰"
          : "DeepSeek peak pricing started — wait for off-peak (16:30 UTC) if you can.",
        offPeak ? "success" : "error",
      );
      setPrevOffPeak(offPeak);
    }
  }, [offPeak, prevOffPeak, toast]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center">
        {/* Status + countdown */}
        <div className="flex-1">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-fg/45">
            <Zap size={13} className="text-flag-gold" /> DeepSeek rate tracker
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {offPeak ? (
              <Chip tone="green" className="px-4 py-2 text-sm">
                <Moon size={14} /> OFF-PEAK — 50% off
              </Chip>
            ) : (
              <Chip tone="red" className="px-4 py-2 text-sm">
                <Sun size={14} /> PEAK — full price
              </Chip>
            )}
            <span className="text-sm font-bold text-fg/60">
              {now.toUTCString().slice(17, 25)} UTC
            </span>
          </div>

          <div className="mt-4 flex items-end gap-2">
            <p className="font-display text-4xl font-bold tabular-nums">
              {pad(h)}<span className="text-fg/30">:</span>{pad(m)}
              <span className="text-fg/30">:</span>{pad(s)}
            </p>
            <p className="mb-1.5 text-sm font-semibold text-fg/50">
              {offPeak ? "until peak pricing" : "until off-peak (50% off)"}
            </p>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-soft px-4 py-3 text-[13px] leading-relaxed text-fg/70">
            <Info size={15} className="mt-0.5 shrink-0 text-flag-red" />
            <span>
              Off-peak runs <strong>16:30 – 00:30 UTC</strong> (00:30 – 08:30 Beijing time) —
              about half the day. Plan heavy work there; you're notified automatically the
              moment it flips. <em>Verify current prices on DeepSeek's pricing page — they
              change.</em>
            </span>
          </div>
        </div>

        {/* Model cheat sheet */}
        <div className="w-full lg:w-[46%]">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-fg/45">
            <Cpu size={13} className="text-flag-red" /> Which DeepSeek does what
          </p>
          <div className="space-y-2.5">
            {MODELS.map((mdl) => (
              <div key={mdl.name} className="rounded-2xl border border-fg/8 bg-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{mdl.name}</p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      mdl.vision.startsWith("✓")
                        ? "bg-flag-green text-cream"
                        : "bg-soft text-fg/50",
                    )}
                  >
                    {mdl.vision.startsWith("✓") ? <Eye size={10} /> : <Zap size={10} />}
                    {mdl.vision.startsWith("✓") ? "Vision" : "Text only"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-fg/60">
                  <strong className="text-fg/80">Best at:</strong> {mdl.best}
                </p>
                <p className="mt-0.5 text-[11px] text-fg/45">
                  <TrendingDown size={10} className="mr-0.5 inline" /> {mdl.price}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fg/45">
            <Eye size={11} className="mr-1 inline text-flag-green" />
            Need image/screenshot understanding? None of DeepSeek's API models accept images
            today — pair with a vision-capable model (e.g. GPT-4o, Claude, Gemini, or
            self-hosted DeepSeek-VL2) for that.
          </p>
        </div>
      </div>
    </Card>
  );
}

// Tiny pill for the admin header — shows status at a glance
export function DeepSeekStatusPill() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const offPeak = isOffPeak(now);
  return (
    <button
      onClick={() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer",
        offPeak ? "bg-flag-green/15 text-flag-green" : "bg-flag-red/10 text-flag-red",
      )}
      title="DeepSeek pricing: off-peak 16:30–00:30 UTC"
    >
      <Clock size={11} />
      {offPeak ? "Off-peak · 50% off" : "Peak pricing"}
    </button>
  );
}
