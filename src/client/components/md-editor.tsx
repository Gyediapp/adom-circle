import { useRef } from "react";
import { Bold, Italic, Heading2, List, Quote, Link as LinkIcon } from "lucide-react";
import { cn } from "@/client/lib/format";

type Mode = "bold" | "italic" | "heading" | "list" | "quote" | "link";

const BTNS: Array<{ mode: Mode; icon: React.ElementType; label: string }> = [
  { mode: "bold", icon: Bold, label: "Bold" },
  { mode: "italic", icon: Italic, label: "Italic" },
  { mode: "heading", icon: Heading2, label: "Heading" },
  { mode: "list", icon: List, label: "Bullet list" },
  { mode: "quote", icon: Quote, label: "Quote" },
  { mode: "link", icon: LinkIcon, label: "Link" },
];

/**
 * Lightweight markdown editor: a toolbar + textarea. Buttons wrap the current
 * selection (or insert at the cursor) with markdown syntax, so members get
 * formatting without learning markdown. The raw markdown is what's stored.
 */
export function MdEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (mode: Mode) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? value.length;
    const v = value;
    let next = v;
    let ns = s;
    let ne = e;

    if (mode === "bold" || mode === "italic") {
      const wrap = mode === "bold" ? "**" : "*";
      const sel = v.slice(s, e) || (mode === "bold" ? "bold text" : "italic text");
      next = `${v.slice(0, s)}${wrap}${sel}${wrap}${v.slice(e)}`;
      ns = s + wrap.length;
      ne = ns + sel.length;
    } else if (mode === "heading") {
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      next = `${v.slice(0, lineStart)}## ${v.slice(lineStart)}`;
      ns = s + 3;
      ne = e + 3;
    } else if (mode === "list") {
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      next = `${v.slice(0, lineStart)}- ${v.slice(lineStart)}`;
      ns = s + 2;
      ne = e + 2;
    } else if (mode === "quote") {
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      next = `${v.slice(0, lineStart)}> ${v.slice(lineStart)}`;
      ns = s + 2;
      ne = e + 2;
    } else if (mode === "link") {
      const sel = v.slice(s, e) || "link text";
      const url =
        window.prompt("Link URL", "https://") || "https://example.com";
      next = `${v.slice(0, s)}[${sel}](${url})${v.slice(e)}`;
      ns = s;
      ne = s + sel.length + url.length + 4;
    }

    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(ns, Math.min(ne, next.length));
    });
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-fg/15 bg-card focus-within:border-flag-red focus-within:ring-2 focus-within:ring-flag-red/15 transition-colors", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-fg/8 bg-soft/50 px-2 py-1.5">
        {BTNS.map((b) => (
          <button
            key={b.mode}
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep textarea selection
            onClick={() => apply(b.mode)}
            title={b.label}
            aria-label={b.label}
            className="rounded-lg p-1.5 text-fg/55 transition-colors hover:bg-ink/5 hover:text-flag-red cursor-pointer"
          >
            <b.icon size={15} />
          </button>
        ))}
        <span className="ml-auto hidden pr-1 text-[10px] font-medium text-fg/35 sm:block">
          **bold** · *italic* · ## heading · - list
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="block w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-fg/35"
      />
    </div>
  );
}
