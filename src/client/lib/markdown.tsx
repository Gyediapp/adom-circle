import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "@/client/lib/format";

// Markdown renders with GitHub-flavoured syntax + single-newline breaks, so
// existing plain text keeps its line breaks. Output is sanitised with DOMPurify
// before it touches the DOM — member content never becomes raw HTML.
marked.setOptions({ gfm: true, breaks: true });

/** Render markdown (or plain text) safely as styled rich text. */
export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => {
    if (!text) return "";
    try {
      return DOMPurify.sanitize(marked.parse(text) as string);
    } catch {
      // Fall back to escaped plain text if parsing ever fails
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }, [text]);

  if (!text) return null;
  return <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain-text preview of markdown for cards — strips syntax, keeps words. */
export function plainText(md: string, max = 160): string {
  if (!md) return "";
  const t = md
    // images/links → their label/text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // bold / italic / code / strikethrough markers
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    // heading + list + quote markers at line starts
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
