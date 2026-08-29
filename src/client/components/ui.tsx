import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn, initials, avatarColor } from "@/client/lib/format";

type Variant = "primary" | "gold" | "ghost" | "outline" | "danger" | "dark";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary:
      "bg-flag-red text-cream hover:bg-[#a80d1e] shadow-lg shadow-flag-red/25",
    gold:
      "bg-gradient-to-b from-[#ffdf4d] via-flag-gold to-[#e8b30a] text-ink hover:from-[#ffe98a] hover:to-gold-deep shadow-lg shadow-flag-gold/30",
    ghost: "text-fg hover:bg-ink/5",
    outline: "border border-fg/20 text-fg hover:border-flag-red hover:text-flag-red",
    danger: "bg-flag-red text-cream hover:bg-[#a80d1e]",
    dark: "bg-ink text-cream hover:bg-ink-2",
  };
  return (
    <button
      className={cn(
        "btn-shine inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.95] active:brightness-90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Chip({
  children,
  tone = "gold",
  className,
}: {
  children: ReactNode;
  tone?: "gold" | "red" | "green" | "ink" | "sand";
  className?: string;
}) {
  const tones = {
    gold: "bg-flag-gold/90 text-fg",
    red: "bg-flag-red/10 text-flag-red border border-flag-red/20",
    green: "bg-flag-green/10 text-flag-green border border-flag-green/20",
    ink: "bg-ink text-cream",
    sand: "bg-soft text-fg border border-fg/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-card shadow-[0_2px_16px_rgba(13,31,23,0.06)] border border-fg/5",
        hover && "card-lift hover:border-flag-gold/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  light = false,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="mb-3 inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.25em] text-flag-red">
        <span className="flag-stripes h-[3px] w-10 rounded-full" aria-hidden />
        {eyebrow}
      </p>
      <h2
        className={cn(
          "font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight",
          light ? "text-cream" : "text-fg",
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className={cn("mt-4 text-base sm:text-lg leading-relaxed", light ? "text-cream/70" : "text-fg/60")}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full rounded-t-3xl sm:rounded-3xl bg-page shadow-2xl max-h-[92vh] overflow-y-auto animate-fade-up",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-ink/5 p-2 text-fg/60 hover:bg-ink/10 hover:text-fg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold text-cream shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: avatarColor(name),
      }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full rounded-full bg-ink/10 overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-flag-red via-flag-gold to-flag-green transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(4, value))}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className={cn("font-display text-3xl sm:text-4xl font-bold", accent ? "text-flag-red" : "text-fg")}>
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-fg/50">{label}</p>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 cursor-pointer group"
      type="button"
    >
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-flag-green" : "bg-ink/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      {label && <span className="text-sm font-medium text-fg/70">{label}</span>}
    </button>
  );
}
