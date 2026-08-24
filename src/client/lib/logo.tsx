import { cn } from "./format";
import { logoMarkMarkup } from "./logo-svg";

// The Black Star of Ghana, drawn as a modern geometric mark
const STAR_PATH =
  "M 80,40 L 90,66.25 L 118.04,67.64 L 96.17,85.25 L 103.51,112.36 L 80,97 L 56.49,112.36 L 63.83,85.25 L 41.96,67.64 L 70,66.25 Z";

export function Star({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} className={className} aria-hidden>
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

// The 3D "AC" monogram — deep-green coin, gold A with the Black Star,
// wrapped by the tricolour C ring. Used in headers, footers and favicons.
export function LogoMark({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: logoMarkMarkup() }}
    />
  );
}

export function Wordmark({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-display font-bold text-2xl tracking-[0.14em]",
          tone === "dark" ? "text-fg" : "text-cream",
        )}
      >
        ADOM
      </span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className="flag-stripes h-[3px] w-6 rounded-full" />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.4em]",
            tone === "dark" ? "text-clay" : "text-gold-soft",
          )}
        >
          Circle · Ghana
        </span>
      </span>
    </div>
  );
}

export function Logo({
  size = 40,
  tone = "dark",
  className,
}: {
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      <Wordmark tone={tone} />
    </div>
  );
}

export function FlagStripes({ className }: { className?: string }) {
  return <div className={cn("flag-stripes h-1.5 w-full rounded-full", className)} />;
}
