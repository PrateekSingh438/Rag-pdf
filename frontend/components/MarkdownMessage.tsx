"use client";
// Renders an assistant answer as Markdown with LaTeX math (KaTeX). Inline [S1]
// citation tags are pre-converted to links and intercepted so they render as the
// same clickable citation chips used elsewhere.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Citation } from "@/lib/api";

// Turn [S1] into a markdown link we intercept in the `a` renderer below.
function withCitationLinks(content: string): string {
  return content.replace(/\[S(\d+)\]/g, "[\\[S$1\\]](#cite-S$1)");
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
