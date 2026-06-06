"use client";
// Renders an assistant answer as Markdown with LaTeX math (KaTeX). Inline [S1]
// citation tags are pre-converted to links and intercepted so they render as the
// same clickable citation chips used elsewhere.
import { ReactNode, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Citation } from "@/lib/api";
import { IconCopy } from "./icons";
import { useToast } from "./Toast";

// Turn [S1] into a markdown link we intercept in the `a` renderer below.
function withCitationLinks(content: string): string {
  return content.replace(/\[S(\d+)\]/g, "[\\[S$1\\]](#cite-S$1)");
}

// A fenced code block with a hover-reveal copy button. Reads the rendered text
// off the <pre> so it copies exactly what's shown, language tag stripped.
function CodeBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const { toast } = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? "");
      toast("Code copied", "success");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  }
  return (
    <div className="group/code relative">
      <button
        onClick={copy}
        title="Copy code"
        aria-label="Copy code"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-slate-700/80 text-slate-200 opacity-0 transition-opacity hover:bg-slate-600 group-hover/code:opacity-100"
      >
        <IconCopy size={14} />
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

export function MarkdownMessage({
  content,
  citations,
  onCitation,
}: {
  content: string;
  citations: Citation[];
  onCitation: (c: Citation) => void;
}) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={{
          pre({ children }) {
            return <CodeBlock>{children}</CodeBlock>;
          },
          a({ href, children }) {
            if (href && href.startsWith("#cite-")) {
              const tag = href.slice("#cite-".length);
              const cit = citations.find((c) => c.tag === tag);
              if (cit) {
                return (
                  <button
                    onClick={() => onCitation(cit)}
                    className="mx-0.5 inline-flex items-center rounded bg-indigo-100 px-1.5 py-0.5 align-baseline text-xs font-semibold text-indigo-700 no-underline hover:bg-indigo-200"
                  >
                    {children}
                  </button>
                );
              }
              return <span>{children}</span>;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                {children}
              </a>
            );
          },
        }}
      >
        {withCitationLinks(content)}
      </ReactMarkdown>
    </div>
  );
}
